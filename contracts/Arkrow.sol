// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Arkrow
/// @notice Native-token escrow for AI agent work agreements between buyers and workers.
contract Arkrow is Ownable2Step, ReentrancyGuard {
    uint256 public constant MAX_FEE_BPS = 500;
    uint256 public constant MAX_REFERRER_BPS = 1000;
    uint64 public constant REVIEW_WINDOW = 3 days;
    uint64 public constant DISPUTE_EXPIRY = 14 days;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    enum Status {
        OPEN,
        PROOF_SUBMITTED,
        RELEASED,
        REFUNDED,
        DISPUTED
    }

    struct Job {
        address buyer;
        address worker;
        address referrer;
        address treasury;    // snapshotted at createJob; immune to later setTreasury
        uint256 amount;
        uint256 feeBps;      // snapshotted at createJob; immune to later setFeeBps
        uint256 referrerBps;
        uint64 deadline;
        uint64 proofTime;
        uint64 disputeTime;
        Status status;
        bytes32 proofHash;
    }

    mapping(uint256 => Job) public jobs;
    uint256 public jobCounter;
    address public treasury;
    uint256 public feeBps;
    /// @notice Sum of all active (OPEN/PROOF_SUBMITTED/DISPUTED) job amounts.
    uint256 public totalLocked;
    /// @notice Sum of all deferred payouts not yet claimed via withdrawPending.
    uint256 public totalPending;
    mapping(address => uint256) public pendingWithdrawals;
    mapping(address => uint256) public jobsCompleted;
    mapping(address => uint256) public totalEarned;

    event JobCreated(
        uint256 indexed jobId,
        address indexed buyer,
        address indexed worker,
        uint256 amount,
        uint64 deadline
    );
    event ProofSubmitted(uint256 indexed jobId, bytes32 proofHash);
    event JobApproved(uint256 indexed jobId, address indexed buyer);
    event JobReleased(
        uint256 indexed jobId,
        address indexed worker,
        uint256 workerAmount,
        uint256 referrerAmount,
        uint256 feeAmount
    );
    event JobRefunded(uint256 indexed jobId, address indexed buyer, uint256 amount);
    event JobDisputed(uint256 indexed jobId, address indexed buyer);
    event DisputeResolved(uint256 indexed jobId, bool payWorker);
    event DisputeExpired(uint256 indexed jobId, address indexed buyer, uint256 amount);
    event FeeUpdated(uint256 oldFee, uint256 newFee);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event NativeRescued(address indexed to, uint256 amount);
    event PaymentDeferred(address indexed recipient, uint256 amount);
    event PendingWithdrawn(address indexed recipient, uint256 amount);

    error ZeroAddress();
    error ZeroAmount();
    error DeadlineInPast();
    error ReferrerBpsTooHigh();
    error ReferrerRequiredWhenBpsSet();
    error FeeBpsTooHigh();
    error NotBuyer();
    error NotWorker();
    error RenounceDisabled();
    error WrongStatus(Status current);
    error DeadlineNotPassed();
    error DeadlineAlreadyPassed();
    error ReviewWindowOpen();
    error ReviewWindowExpired();
    error DisputeNotExpired();
    error DisputeAlreadyExpired();
    error TransferFailed();
    error ZeroProofHash();
    error ExceedsExcess();

    /// @notice Initializes the escrow contract.
    /// @param _treasury Treasury address that receives platform fees.
    /// @param _feeBps Fee in basis points charged on each release.
    constructor(address _treasury, uint256 _feeBps) Ownable(msg.sender) {
        if (_treasury == address(0)) revert ZeroAddress();
        if (_feeBps > MAX_FEE_BPS) revert FeeBpsTooHigh();

        treasury = _treasury;
        feeBps = _feeBps;
    }

    /// @notice Creates a new escrow job funded with native value.
    /// @param worker Address that will perform the work.
    /// @param deadline Timestamp after which buyer can refund if no proof is submitted.
    /// @param referrer Optional referrer address.
    /// @param referrerBps Referrer share in basis points.
    function createJob(address worker, uint64 deadline, address referrer, uint256 referrerBps) external payable nonReentrant {
        if (worker == address(0)) revert ZeroAddress();
        if (msg.value == 0) revert ZeroAmount();
        if (deadline <= block.timestamp) revert DeadlineInPast();
        if (referrerBps > MAX_REFERRER_BPS) revert ReferrerBpsTooHigh();
        if (referrerBps > 0 && referrer == address(0)) revert ReferrerRequiredWhenBpsSet();

        unchecked {
            jobCounter += 1;
        }
        uint256 jobId = jobCounter;

        jobs[jobId] = Job({
            buyer: msg.sender,
            worker: worker,
            referrer: referrer,
            treasury: treasury,
            amount: msg.value,
            feeBps: feeBps,
            referrerBps: referrerBps,
            deadline: deadline,
            proofTime: 0,
            disputeTime: 0,
            status: Status.OPEN,
            proofHash: bytes32(0)
        });
        totalLocked += msg.value;

        emit JobCreated(jobId, msg.sender, worker, msg.value, deadline);
    }

    /// @notice Submits proof of completed work for an open job.
    /// @param jobId Identifier of the job.
    /// @param proofHash Hash of externally stored proof data.
    function submitProof(uint256 jobId, bytes32 proofHash) external nonReentrant {
        Job storage job = jobs[jobId];

        if (job.status != Status.OPEN) revert WrongStatus(job.status);
        if (msg.sender != job.worker) revert NotWorker();
        if (block.timestamp > job.deadline) revert DeadlineAlreadyPassed();
        if (proofHash == bytes32(0)) revert ZeroProofHash();

        job.proofHash = proofHash;
        job.proofTime = uint64(block.timestamp);
        job.status = Status.PROOF_SUBMITTED;

        emit ProofSubmitted(jobId, proofHash);
    }

    /// @notice Approves submitted proof and releases funds.
    /// @param jobId Identifier of the job.
    function approve(uint256 jobId) external nonReentrant {
        Job storage job = jobs[jobId];

        if (job.status != Status.PROOF_SUBMITTED) revert WrongStatus(job.status);
        if (msg.sender != job.buyer) revert NotBuyer();

        emit JobApproved(jobId, msg.sender);
        _release(jobId);
    }

    /// @notice Releases funds after the buyer review window ends.
    /// @param jobId Identifier of the job.
    function release(uint256 jobId) external nonReentrant {
        Job storage job = jobs[jobId];

        if (job.status != Status.PROOF_SUBMITTED) revert WrongStatus(job.status);
        if (block.timestamp < uint256(job.proofTime) + REVIEW_WINDOW) revert ReviewWindowOpen();

        _release(jobId);
    }

    /// @notice Refunds a job when no proof is submitted by deadline.
    /// @param jobId Identifier of the job.
    function refund(uint256 jobId) external nonReentrant {
        Job storage job = jobs[jobId];

        if (job.status != Status.OPEN) revert WrongStatus(job.status);
        if (msg.sender != job.buyer) revert NotBuyer();
        if (block.timestamp <= job.deadline) revert DeadlineNotPassed();

        // Cache before state mutation (CEI).
        address buyer = job.buyer;
        uint256 amount = job.amount;

        job.status = Status.REFUNDED;
        totalLocked -= amount;

        (bool ok,) = buyer.call{value: amount}("");
        if (!ok) {
            pendingWithdrawals[buyer] += amount;
            totalPending += amount;
            emit PaymentDeferred(buyer, amount);
        }

        emit JobRefunded(jobId, buyer, amount);
    }

    /// @notice Escalates a submitted-proof job into owner arbitration.
    /// @param jobId Identifier of the job.
    function dispute(uint256 jobId) external nonReentrant {
        Job storage job = jobs[jobId];

        if (job.status != Status.PROOF_SUBMITTED) revert WrongStatus(job.status);
        if (msg.sender != job.buyer) revert NotBuyer();
        if (block.timestamp >= uint256(job.proofTime) + REVIEW_WINDOW) revert ReviewWindowExpired();

        job.disputeTime = uint64(block.timestamp);
        job.status = Status.DISPUTED;

        emit JobDisputed(jobId, msg.sender);
    }

    /// @notice Resolves a dispute by paying worker (and fee/referrer) or refunding buyer.
    /// @param jobId Identifier of the job.
    /// @param payWorker True to release to worker path, false to refund buyer.
    function resolveDispute(uint256 jobId, bool payWorker) external nonReentrant onlyOwner {
        Job storage job = jobs[jobId];

        if (job.status != Status.DISPUTED) revert WrongStatus(job.status);
        if (block.timestamp >= uint256(job.disputeTime) + DISPUTE_EXPIRY) revert DisputeAlreadyExpired();

        emit DisputeResolved(jobId, payWorker);

        if (payWorker) {
            _release(jobId);
        } else {
            // Cache before state mutation (CEI).
            address buyer = job.buyer;
            uint256 amount = job.amount;

            job.status = Status.REFUNDED;
            totalLocked -= amount;

            (bool ok,) = buyer.call{value: amount}("");
            if (!ok) {
                pendingWithdrawals[buyer] += amount;
                totalPending += amount;
                emit PaymentDeferred(buyer, amount);
            }

            emit JobRefunded(jobId, buyer, amount);
        }
    }

    /// @notice Refunds the buyer when a DISPUTED job has not been resolved within DISPUTE_EXPIRY.
    /// @dev Anyone may call this after the expiry window; no owner action required.
    /// @param jobId Identifier of the job.
    function expireDispute(uint256 jobId) external nonReentrant {
        Job storage job = jobs[jobId];

        if (job.status != Status.DISPUTED) revert WrongStatus(job.status);
        if (block.timestamp < uint256(job.disputeTime) + DISPUTE_EXPIRY) revert DisputeNotExpired();

        // Cache before state mutation (CEI).
        address buyer = job.buyer;
        uint256 amount = job.amount;

        job.status = Status.REFUNDED;
        totalLocked -= amount;

        emit DisputeExpired(jobId, buyer, amount);

        (bool ok,) = buyer.call{value: amount}("");
        if (!ok) {
            pendingWithdrawals[buyer] += amount;
            totalPending += amount;
            emit PaymentDeferred(buyer, amount);
        }

        emit JobRefunded(jobId, buyer, amount);
    }

    /// @notice Returns the full Job struct for a given jobId.
    /// @param jobId Identifier of the job.
    /// @return The Job struct.
    function getJob(uint256 jobId) external view returns (Job memory) {
        return jobs[jobId];
    }

    /// @notice Sets a new platform fee in basis points.
    /// @param newFee New fee in basis points.
    function setFeeBps(uint256 newFee) external onlyOwner {
        if (newFee > MAX_FEE_BPS) revert FeeBpsTooHigh();

        emit FeeUpdated(feeBps, newFee);
        feeBps = newFee;
    }

    /// @notice Sets a new treasury address.
    /// @param newTreasury Address that receives fees.
    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();

        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }

    /// @notice Recovers excess native value not belonging to active escrow or deferred-payout accounting.
    /// @dev Only transfers value above totalLocked + totalPending to avoid draining user obligations.
    /// @param to Recipient of rescued native value.
    /// @param amount Amount of native value to rescue.
    function rescueExcessNative(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();

        uint256 obligations = totalLocked + totalPending;
        uint256 excess = address(this).balance > obligations ? address(this).balance - obligations : 0;
        if (amount > excess) revert ExceedsExcess();

        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit NativeRescued(to, amount);
    }

    /// @notice Withdraws deferred native payouts when push transfer previously failed.
    function withdrawPending() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert ZeroAmount();

        // CEI: zero balance and decrement global counter before transfer.
        pendingWithdrawals[msg.sender] = 0;
        totalPending -= amount;

        (bool ok,) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit PendingWithdrawn(msg.sender, amount);
    }

    /// @notice Disables ownership renunciation.
    function renounceOwnership() public pure override {
        revert RenounceDisabled();
    }

    /// @notice Internal release path that distributes fee, referrer reward, and worker payout.
    /// @dev Caller must enforce status preconditions before invoking.
    /// @param jobId Identifier of the job.
    function _release(uint256 jobId) internal {
        Job storage job = jobs[jobId];

        job.status = Status.RELEASED;
        totalLocked -= job.amount;

        // Use snapshotted fee and treasury (immune to post-createJob admin changes).
        uint256 feeAmount = (job.amount * job.feeBps) / BPS_DENOMINATOR;
        uint256 referrerAmount = (job.referrer != address(0) && job.referrerBps > 0)
            ? (job.amount * job.referrerBps) / BPS_DENOMINATOR
            : 0;
        uint256 workerAmount = job.amount - feeAmount - referrerAmount;

        jobsCompleted[job.worker] += 1;
        totalEarned[job.worker] += workerAmount;

        if (feeAmount > 0) {
            (bool feeOk,) = job.treasury.call{value: feeAmount}("");
            if (!feeOk) {
                pendingWithdrawals[job.treasury] += feeAmount;
                totalPending += feeAmount;
                emit PaymentDeferred(job.treasury, feeAmount);
            }
        }

        if (referrerAmount > 0) {
            (bool refOk,) = job.referrer.call{value: referrerAmount}("");
            if (!refOk) {
                pendingWithdrawals[job.referrer] += referrerAmount;
                totalPending += referrerAmount;
                emit PaymentDeferred(job.referrer, referrerAmount);
            }
        }

        (bool workerOk,) = job.worker.call{value: workerAmount}("");
        if (!workerOk) {
            pendingWithdrawals[job.worker] += workerAmount;
            totalPending += workerAmount;
            emit PaymentDeferred(job.worker, workerAmount);
        }

        emit JobReleased(jobId, job.worker, workerAmount, referrerAmount, feeAmount);
    }
}
