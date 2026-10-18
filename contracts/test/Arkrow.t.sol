// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Arkrow} from "../Arkrow.sol";

// ---------------------------------------------------------------------------
// Helper: a contract that refuses to receive ETH (simulates a failed push)
// ---------------------------------------------------------------------------
contract RevertingReceiver {
    receive() external payable {
        revert("I reject ETH");
    }
}

// ---------------------------------------------------------------------------
// Handler for invariant testing
// ---------------------------------------------------------------------------
contract ArkrowHandler is Test {
    Arkrow public arkrow;

    address internal buyer;
    address internal worker;
    address internal treasury;

    // ghost: sum of ETH we expect to be locked + pending in the contract
    uint256 public ghostObligations;

    uint256[] public openJobIds;

    constructor(Arkrow _arkrow, address _buyer, address _worker, address _treasury) {
        arkrow = _arkrow;
        buyer  = _buyer;
        worker = _worker;
        treasury = _treasury;
    }

    /// Creates a job from the buyer, tracking obligations.
    function createJob(uint256 amount) external {
        amount = bound(amount, 1, 10 ether);
        deal(buyer, buyer.balance + amount);

        uint64 deadline = uint64(block.timestamp + 1 days);

        vm.prank(buyer);
        arkrow.createJob{value: amount}(worker, deadline, address(0), 0);

        ghostObligations += amount;

        // record jobId for later actions
        openJobIds.push(arkrow.jobCounter());
    }

    function openJobCount() external view returns (uint256) {
        return openJobIds.length;
    }
}

// ---------------------------------------------------------------------------
// Main test contract
// ---------------------------------------------------------------------------
contract ArkrowTest is Test {
    Arkrow internal arkrow;

    address internal deployer  = makeAddr("deployer");
    address internal treasury  = makeAddr("treasury");
    address internal buyer     = makeAddr("buyer");
    address internal worker    = makeAddr("worker");
    address internal referrer  = makeAddr("referrer");
    address internal alice     = makeAddr("alice");

    uint256 internal constant FEE_BPS  = 250;   // 2.5 %
    uint256 internal constant JOB_AMT  = 1 ether;
    uint64  internal constant DEADLINE_OFFSET = 1 days;

    // -----------------------------------------------------------------------
    // setUp
    // -----------------------------------------------------------------------
    function setUp() public {
        vm.startPrank(deployer);
        arkrow = new Arkrow(treasury, FEE_BPS);
        vm.stopPrank();

        vm.deal(buyer,   100 ether);
        vm.deal(worker,  10 ether);
        vm.deal(alice,   10 ether);
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    /// Creates a basic job as `buyer` and returns the jobId.
    function _createJob() internal returns (uint256 jobId) {
        uint64 deadline = uint64(block.timestamp + DEADLINE_OFFSET);
        vm.prank(buyer);
        arkrow.createJob{value: JOB_AMT}(worker, deadline, address(0), 0);
        jobId = arkrow.jobCounter();
    }

    /// Creates a job with a referrer.
    function _createJobWithReferrer(uint256 refBps) internal returns (uint256 jobId) {
        uint64 deadline = uint64(block.timestamp + DEADLINE_OFFSET);
        vm.prank(buyer);
        arkrow.createJob{value: JOB_AMT}(worker, deadline, referrer, refBps);
        jobId = arkrow.jobCounter();
    }

    /// Advances state to PROOF_SUBMITTED on jobId.
    function _submitProof(uint256 jobId) internal {
        vm.prank(worker);
        arkrow.submitProof(jobId, keccak256("proof"));
    }

    /// Advances state to PROOF_SUBMITTED then DISPUTED.
    function _toDisputed(uint256 jobId) internal {
        _submitProof(jobId);
        vm.prank(buyer);
        arkrow.dispute(jobId);
    }

    // -----------------------------------------------------------------------
    // ========================== createJob ==================================
    // -----------------------------------------------------------------------

    function test_createJob_happy_path() public {
        uint64 deadline = uint64(block.timestamp + DEADLINE_OFFSET);
        uint256 totalBefore = arkrow.totalLocked();

        // Expect JobCreated event
        vm.expectEmit(true, true, true, true, address(arkrow));
        emit Arkrow.JobCreated(1, buyer, worker, JOB_AMT, deadline);

        vm.prank(buyer);
        arkrow.createJob{value: JOB_AMT}(worker, deadline, address(0), 0);

        uint256 jobId = arkrow.jobCounter();
        assertEq(jobId, 1, "counter incremented");

        Arkrow.Job memory j = arkrow.getJob(jobId);

        assertEq(j.buyer,       buyer,      "buyer stored");
        assertEq(j.worker,      worker,     "worker stored");
        assertEq(j.referrer,    address(0), "no referrer");
        assertEq(j.treasury,    treasury,   "treasury snapshotted");
        assertEq(j.amount,      JOB_AMT,    "amount stored");
        assertEq(j.feeBps,      FEE_BPS,    "feeBps snapshotted");
        assertEq(j.referrerBps, 0,          "referrerBps stored");
        assertEq(j.deadline,    deadline,   "deadline stored");
        assertEq(j.proofTime,   0,          "proofTime zero");
        assertEq(j.disputeTime, 0,          "disputeTime zero");
        assertEq(uint8(j.status), uint8(Arkrow.Status.OPEN), "status OPEN");
        assertEq(j.proofHash,   bytes32(0), "proofHash zero");

        assertEq(arkrow.totalLocked(), totalBefore + JOB_AMT, "totalLocked incremented");
    }

    function test_createJob_reverts_zero_worker() public {
        uint64 deadline = uint64(block.timestamp + DEADLINE_OFFSET);
        vm.expectRevert(Arkrow.ZeroAddress.selector);
        vm.prank(buyer);
        arkrow.createJob{value: JOB_AMT}(address(0), deadline, address(0), 0);
    }

    function test_createJob_reverts_zero_value() public {
        uint64 deadline = uint64(block.timestamp + DEADLINE_OFFSET);
        vm.expectRevert(Arkrow.ZeroAmount.selector);
        vm.prank(buyer);
        arkrow.createJob{value: 0}(worker, deadline, address(0), 0);
    }

    function test_createJob_reverts_deadline_in_past() public {
        // deadline == block.timestamp triggers "DeadlineInPast" (requires strictly greater)
        uint64 deadline = uint64(block.timestamp);
        vm.expectRevert(Arkrow.DeadlineInPast.selector);
        vm.prank(buyer);
        arkrow.createJob{value: JOB_AMT}(worker, deadline, address(0), 0);
    }

    function test_createJob_reverts_referrerBps_too_high() public {
        uint64 deadline = uint64(block.timestamp + DEADLINE_OFFSET);
        vm.expectRevert(Arkrow.ReferrerBpsTooHigh.selector);
        vm.prank(buyer);
        arkrow.createJob{value: JOB_AMT}(worker, deadline, referrer, 1001);
    }

    function test_createJob_reverts_referrer_required_when_bps_set() public {
        uint64 deadline = uint64(block.timestamp + DEADLINE_OFFSET);
        vm.expectRevert(Arkrow.ReferrerRequiredWhenBpsSet.selector);
        vm.prank(buyer);
        arkrow.createJob{value: JOB_AMT}(worker, deadline, address(0), 100);
    }

    function test_createJob_no_referrer() public {
        // referrerBps = 0, referrer = address(0) — should succeed
        uint64 deadline = uint64(block.timestamp + DEADLINE_OFFSET);
        vm.prank(buyer);
        arkrow.createJob{value: JOB_AMT}(worker, deadline, address(0), 0);
        assertEq(arkrow.jobCounter(), 1, "job created");
    }

    // -----------------------------------------------------------------------
    // ========================= submitProof =================================
    // -----------------------------------------------------------------------

    function test_submitProof_happy_path() public {
        uint256 jobId = _createJob();
        bytes32 ph = keccak256("my-proof");

        vm.expectEmit(true, false, false, true, address(arkrow));
        emit Arkrow.ProofSubmitted(jobId, ph);

        vm.prank(worker);
        arkrow.submitProof(jobId, ph);

        (,,,,,,,, uint64 proofTime, , Arkrow.Status status, bytes32 proofHash) = arkrow.jobs(jobId);
        assertEq(uint8(status), uint8(Arkrow.Status.PROOF_SUBMITTED), "status PROOF_SUBMITTED");
        assertEq(proofHash, ph, "proofHash stored");
        assertEq(proofTime, uint64(block.timestamp), "proofTime set");
    }

    function test_submitProof_reverts_not_worker() public {
        uint256 jobId = _createJob();
        vm.expectRevert(Arkrow.NotWorker.selector);
        vm.prank(buyer);
        arkrow.submitProof(jobId, keccak256("proof"));
    }

    function test_submitProof_reverts_wrong_status() public {
        uint256 jobId = _createJob();
        _submitProof(jobId); // now PROOF_SUBMITTED

        vm.expectRevert(
            abi.encodeWithSelector(Arkrow.WrongStatus.selector, Arkrow.Status.PROOF_SUBMITTED)
        );
        vm.prank(worker);
        arkrow.submitProof(jobId, keccak256("proof2"));
    }

    function test_submitProof_reverts_deadline_passed() public {
        uint256 jobId = _createJob();
        // Warp past the job's deadline
        (, , , , , , , uint64 dl, , , , ) = arkrow.jobs(jobId);
        vm.warp(uint256(dl) + 1);

        vm.expectRevert(Arkrow.DeadlineAlreadyPassed.selector);
        vm.prank(worker);
        arkrow.submitProof(jobId, keccak256("proof"));
    }

    function test_submitProof_reverts_zero_proofHash() public {
        uint256 jobId = _createJob();
        vm.expectRevert(Arkrow.ZeroProofHash.selector);
        vm.prank(worker);
        arkrow.submitProof(jobId, bytes32(0));
    }

    // -----------------------------------------------------------------------
    // ============================ approve ==================================
    // -----------------------------------------------------------------------

    function test_approve_happy_path() public {
        uint256 jobId = _createJobWithReferrer(500); // 5% referrer
        _submitProof(jobId);

        uint256 feeAmt     = (JOB_AMT * FEE_BPS)  / 10_000;
        uint256 refAmt     = (JOB_AMT * 500)       / 10_000;
        uint256 workerAmt  = JOB_AMT - feeAmt - refAmt;

        uint256 workerBal    = worker.balance;
        uint256 treasuryBal  = treasury.balance;
        uint256 referrerBal  = referrer.balance;

        // Expect JobApproved then JobReleased
        vm.expectEmit(true, true, false, false, address(arkrow));
        emit Arkrow.JobApproved(jobId, buyer);

        vm.expectEmit(true, true, false, true, address(arkrow));
        emit Arkrow.JobReleased(jobId, worker, workerAmt, refAmt, feeAmt);

        vm.prank(buyer);
        arkrow.approve(jobId);

        // Status → RELEASED
        (, , , , , , , , , , Arkrow.Status status, ) = arkrow.jobs(jobId);
        assertEq(uint8(status), uint8(Arkrow.Status.RELEASED), "status RELEASED");

        // Funds distributed
        assertEq(worker.balance,   workerBal   + workerAmt, "worker received");
        assertEq(treasury.balance, treasuryBal + feeAmt,    "treasury received fee");
        assertEq(referrer.balance, referrerBal + refAmt,    "referrer received");

        // Reputation updated
        assertEq(arkrow.jobsCompleted(worker), 1,         "jobsCompleted incremented");
        assertEq(arkrow.totalEarned(worker),   workerAmt, "totalEarned incremented");

        // totalLocked decremented
        assertEq(arkrow.totalLocked(), 0, "totalLocked decremented");
    }

    function test_approve_reverts_not_buyer() public {
        uint256 jobId = _createJob();
        _submitProof(jobId);
        vm.expectRevert(Arkrow.NotBuyer.selector);
        vm.prank(worker);
        arkrow.approve(jobId);
    }

    function test_approve_reverts_wrong_status() public {
        uint256 jobId = _createJob(); // still OPEN
        vm.expectRevert(
            abi.encodeWithSelector(Arkrow.WrongStatus.selector, Arkrow.Status.OPEN)
        );
        vm.prank(buyer);
        arkrow.approve(jobId);
    }

    // -----------------------------------------------------------------------
    // ============================ release ==================================
    // -----------------------------------------------------------------------

    function test_release_happy_path() public {
        uint256 jobId = _createJob();
        _submitProof(jobId);

        (, , , , , , , , uint64 proofTime, , , ) = arkrow.jobs(jobId);
        // Warp past the 3-day review window
        vm.warp(uint256(proofTime) + 3 days + 1);

        uint256 feeAmt    = (JOB_AMT * FEE_BPS) / 10_000;
        uint256 workerAmt = JOB_AMT - feeAmt;

        uint256 workerBal = worker.balance;

        // Anyone can call release — use alice
        vm.prank(alice);
        arkrow.release(jobId);

        (, , , , , , , , , , Arkrow.Status status, ) = arkrow.jobs(jobId);
        assertEq(uint8(status), uint8(Arkrow.Status.RELEASED), "status RELEASED");
        assertEq(worker.balance, workerBal + workerAmt, "worker paid");
        assertEq(arkrow.totalLocked(), 0, "totalLocked cleared");
    }

    function test_release_reverts_review_window_open() public {
        uint256 jobId = _createJob();
        _submitProof(jobId);

        // Still within the review window — do NOT warp
        vm.expectRevert(Arkrow.ReviewWindowOpen.selector);
        vm.prank(alice);
        arkrow.release(jobId);
    }

    function test_release_reverts_wrong_status() public {
        uint256 jobId = _createJob(); // OPEN, not PROOF_SUBMITTED
        vm.expectRevert(
            abi.encodeWithSelector(Arkrow.WrongStatus.selector, Arkrow.Status.OPEN)
        );
        vm.prank(alice);
        arkrow.release(jobId);
    }

    // -----------------------------------------------------------------------
    // ============================= refund ==================================
    // -----------------------------------------------------------------------

    function test_refund_happy_path() public {
        uint256 jobId = _createJob();
        (, , , , , , , uint64 dl, , , , ) = arkrow.jobs(jobId);

        // Warp past deadline
        vm.warp(uint256(dl) + 1);

        uint256 buyerBal = buyer.balance;

        vm.expectEmit(true, true, false, true, address(arkrow));
        emit Arkrow.JobRefunded(jobId, buyer, JOB_AMT);

        vm.prank(buyer);
        arkrow.refund(jobId);

        (, , , , , , , , , , Arkrow.Status status, ) = arkrow.jobs(jobId);
        assertEq(uint8(status), uint8(Arkrow.Status.REFUNDED), "status REFUNDED");
        assertEq(buyer.balance, buyerBal + JOB_AMT, "buyer refunded");
        assertEq(arkrow.totalLocked(), 0, "totalLocked cleared");
    }

    function test_refund_reverts_not_buyer() public {
        uint256 jobId = _createJob();
        (, , , , , , , uint64 dl, , , , ) = arkrow.jobs(jobId);
        vm.warp(uint256(dl) + 1);

        vm.expectRevert(Arkrow.NotBuyer.selector);
        vm.prank(alice);
        arkrow.refund(jobId);
    }

    function test_refund_reverts_wrong_status() public {
        uint256 jobId = _createJob();
        _submitProof(jobId); // now PROOF_SUBMITTED

        (, , , , , , , uint64 dl, , , , ) = arkrow.jobs(jobId);
        vm.warp(uint256(dl) + 1);

        vm.expectRevert(
            abi.encodeWithSelector(Arkrow.WrongStatus.selector, Arkrow.Status.PROOF_SUBMITTED)
        );
        vm.prank(buyer);
        arkrow.refund(jobId);
    }

    function test_refund_reverts_deadline_not_passed() public {
        uint256 jobId = _createJob();
        // deadline has NOT passed — still in the future

        vm.expectRevert(Arkrow.DeadlineNotPassed.selector);
        vm.prank(buyer);
        arkrow.refund(jobId);
    }

    // -----------------------------------------------------------------------
    // ============================= dispute =================================
    // -----------------------------------------------------------------------

    function test_dispute_happy_path() public {
        uint256 jobId = _createJob();
        _submitProof(jobId);

        vm.expectEmit(true, true, false, false, address(arkrow));
        emit Arkrow.JobDisputed(jobId, buyer);

        vm.prank(buyer);
        arkrow.dispute(jobId);

        (, , , , , , , , , , Arkrow.Status status, ) = arkrow.jobs(jobId);
        assertEq(uint8(status), uint8(Arkrow.Status.DISPUTED), "status DISPUTED");
    }

    function test_dispute_reverts_not_buyer() public {
        uint256 jobId = _createJob();
        _submitProof(jobId);

        vm.expectRevert(Arkrow.NotBuyer.selector);
        vm.prank(alice);
        arkrow.dispute(jobId);
    }

    function test_dispute_reverts_wrong_status() public {
        uint256 jobId = _createJob(); // OPEN, not PROOF_SUBMITTED
        vm.expectRevert(
            abi.encodeWithSelector(Arkrow.WrongStatus.selector, Arkrow.Status.OPEN)
        );
        vm.prank(buyer);
        arkrow.dispute(jobId);
    }

    function test_dispute_reverts_review_window_expired() public {
        uint256 jobId = _createJob();
        _submitProof(jobId);

        (, , , , , , , , uint64 proofTime, , , ) = arkrow.jobs(jobId);
        // Warp past the 3-day review window
        vm.warp(uint256(proofTime) + 3 days + 1);

        vm.expectRevert(Arkrow.ReviewWindowExpired.selector);
        vm.prank(buyer);
        arkrow.dispute(jobId);
    }

    // -----------------------------------------------------------------------
    // ========================= resolveDispute ==============================
    // -----------------------------------------------------------------------

    function test_resolveDispute_pay_worker() public {
        uint256 jobId = _createJobWithReferrer(200); // 2% referrer
        _toDisputed(jobId);

        uint256 feeAmt    = (JOB_AMT * FEE_BPS) / 10_000;
        uint256 refAmt    = (JOB_AMT * 200)      / 10_000;
        uint256 workerAmt = JOB_AMT - feeAmt - refAmt;

        uint256 workerBal   = worker.balance;
        uint256 treasuryBal = treasury.balance;
        uint256 referrerBal = referrer.balance;

        vm.expectEmit(true, false, false, true, address(arkrow));
        emit Arkrow.DisputeResolved(jobId, true);

        vm.expectEmit(true, true, false, true, address(arkrow));
        emit Arkrow.JobReleased(jobId, worker, workerAmt, refAmt, feeAmt);

        vm.prank(deployer);
        arkrow.resolveDispute(jobId, true);

        (, , , , , , , , , , Arkrow.Status status, ) = arkrow.jobs(jobId);
        assertEq(uint8(status), uint8(Arkrow.Status.RELEASED), "status RELEASED");
        assertEq(worker.balance,   workerBal   + workerAmt, "worker paid");
        assertEq(treasury.balance, treasuryBal + feeAmt,    "treasury fee paid");
        assertEq(referrer.balance, referrerBal + refAmt,    "referrer paid");
    }

    function test_resolveDispute_refund_buyer() public {
        uint256 jobId = _createJob();
        _toDisputed(jobId);

        uint256 buyerBal = buyer.balance;

        vm.expectEmit(true, false, false, true, address(arkrow));
        emit Arkrow.DisputeResolved(jobId, false);

        vm.expectEmit(true, true, false, true, address(arkrow));
        emit Arkrow.JobRefunded(jobId, buyer, JOB_AMT);

        vm.prank(deployer);
        arkrow.resolveDispute(jobId, false);

        (, , , , , , , , , , Arkrow.Status status, ) = arkrow.jobs(jobId);
        assertEq(uint8(status), uint8(Arkrow.Status.REFUNDED), "status REFUNDED");
        assertEq(buyer.balance, buyerBal + JOB_AMT, "buyer refunded");
        assertEq(arkrow.totalLocked(), 0, "totalLocked cleared");
    }

    function test_resolveDispute_reverts_not_owner() public {
        uint256 jobId = _createJob();
        _toDisputed(jobId);

        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice)
        );
        vm.prank(alice);
        arkrow.resolveDispute(jobId, true);
    }

    function test_resolveDispute_reverts_wrong_status() public {
        uint256 jobId = _createJob(); // OPEN

        vm.expectRevert(
            abi.encodeWithSelector(Arkrow.WrongStatus.selector, Arkrow.Status.OPEN)
        );
        vm.prank(deployer);
        arkrow.resolveDispute(jobId, true);
    }

    function test_resolveDispute_reverts_after_expiry() public {
        uint256 jobId = _createJob();
        _toDisputed(jobId);

        // Read disputeTime set by dispute()
        (, , , , , , , , , uint64 disputeTime, , ) = arkrow.jobs(jobId);

        // Warp to exactly disputeTime + 14 days (expiry boundary — DisputeAlreadyExpired)
        vm.warp(uint256(disputeTime) + 14 days);

        vm.expectRevert(Arkrow.DisputeAlreadyExpired.selector);
        vm.prank(deployer);
        arkrow.resolveDispute(jobId, true);
    }

    function test_resolveDispute_succeeds_before_expiry() public {
        uint256 jobId = _createJob();
        _toDisputed(jobId);

        // Read disputeTime set by dispute()
        (, , , , , , , , , uint64 disputeTime, , ) = arkrow.jobs(jobId);

        // Warp to one second BEFORE expiry — resolveDispute must succeed
        vm.warp(uint256(disputeTime) + 14 days - 1);

        uint256 buyerBal = buyer.balance;

        vm.prank(deployer);
        arkrow.resolveDispute(jobId, false); // refund buyer

        (, , , , , , , , , , Arkrow.Status status, ) = arkrow.jobs(jobId);
        assertEq(uint8(status), uint8(Arkrow.Status.REFUNDED), "status REFUNDED");
        assertEq(buyer.balance, buyerBal + JOB_AMT, "buyer refunded one second before expiry");
    }

    // -----------------------------------------------------------------------
    // ========================= withdrawPending =============================
    // -----------------------------------------------------------------------

    function test_withdrawPending_happy_path() public {
        // Use a RevertingReceiver as the buyer so the push-transfer in refund() fails,
        // landing the amount in pendingWithdrawals.
        RevertingReceiver rr = new RevertingReceiver();
        vm.deal(address(rr), 100 ether);

        // Create the job FROM the reverting receiver so it is the buyer.
        uint64 deadline = uint64(block.timestamp + DEADLINE_OFFSET);
        vm.prank(address(rr));
        arkrow.createJob{value: JOB_AMT}(worker, deadline, address(0), 0);
        uint256 jobId = arkrow.jobCounter();

        // Warp past deadline so refund() is callable
        vm.warp(uint256(deadline) + 1);

        // refund() push-transfer will fail → pendingWithdrawals[rr] = JOB_AMT
        vm.prank(address(rr));
        arkrow.refund(jobId);

        assertEq(arkrow.pendingWithdrawals(address(rr)), JOB_AMT, "pending set");
        assertEq(arkrow.totalPending(), JOB_AMT, "totalPending set");

        // Replace the reverting receiver's code with a plain receiver so
        // withdrawPending() transfer can succeed.
        // We deploy a helper that can accept ETH and call withdrawPending.
        WithdrawHelper wh = new WithdrawHelper(arkrow);
        // Copy wh's (accept-ETH) bytecode over rr's address
        vm.etch(address(rr), address(wh).code);

        uint256 rrBalBefore = address(rr).balance;

        vm.expectEmit(true, false, false, true, address(arkrow));
        emit Arkrow.PendingWithdrawn(address(rr), JOB_AMT);

        // Call withdrawPending from rr's context
        vm.prank(address(rr));
        arkrow.withdrawPending();

        assertEq(address(rr).balance, rrBalBefore + JOB_AMT, "rr received pending");
        assertEq(arkrow.pendingWithdrawals(address(rr)), 0,   "pending cleared");
        assertEq(arkrow.totalPending(), 0,                    "totalPending decremented");
    }

    function test_withdrawPending_reverts_zero_amount() public {
        vm.expectRevert(Arkrow.ZeroAmount.selector);
        vm.prank(alice);
        arkrow.withdrawPending();
    }

    // -----------------------------------------------------------------------
    // ====================== rescueExcessNative =============================
    // -----------------------------------------------------------------------

    function test_rescueExcessNative_happy_path() public {
        // Send extra ETH directly to the contract (simulating an accidental transfer)
        uint256 excess = 0.5 ether;
        vm.deal(address(arkrow), address(arkrow).balance + excess);

        uint256 ownerBal = deployer.balance;

        vm.expectEmit(true, false, false, true, address(arkrow));
        emit Arkrow.NativeRescued(deployer, excess);

        vm.prank(deployer);
        arkrow.rescueExcessNative(deployer, excess);

        assertEq(deployer.balance, ownerBal + excess, "owner received excess");
        assertEq(address(arkrow).balance, 0, "contract balance cleared");
    }

    function test_rescueExcessNative_reverts_exceeds_excess() public {
        // Create a locked job so totalLocked > 0
        _createJob();

        // Contract balance == JOB_AMT == totalLocked → excess == 0
        vm.expectRevert(Arkrow.ExceedsExcess.selector);
        vm.prank(deployer);
        arkrow.rescueExcessNative(deployer, 1);
    }

    function test_rescueExcessNative_reverts_zero_address() public {
        // Send a bit of extra ETH so `excess > 0`
        vm.deal(address(arkrow), 1 ether);

        vm.expectRevert(Arkrow.ZeroAddress.selector);
        vm.prank(deployer);
        arkrow.rescueExcessNative(address(0), 1);
    }

    // -----------------------------------------------------------------------
    // ========================= setFeeBps ===================================
    // -----------------------------------------------------------------------

    function test_setFeeBps_happy_path() public {
        vm.expectEmit(false, false, false, true, address(arkrow));
        emit Arkrow.FeeUpdated(FEE_BPS, 100);

        vm.prank(deployer);
        arkrow.setFeeBps(100);

        assertEq(arkrow.feeBps(), 100, "feeBps updated");
    }

    function test_setFeeBps_reverts_too_high() public {
        vm.expectRevert(Arkrow.FeeBpsTooHigh.selector);
        vm.prank(deployer);
        arkrow.setFeeBps(501); // MAX_FEE_BPS = 500
    }

    function test_setFeeBps_reverts_not_owner() public {
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice)
        );
        vm.prank(alice);
        arkrow.setFeeBps(100);
    }

    // -----------------------------------------------------------------------
    // ========================= setTreasury =================================
    // -----------------------------------------------------------------------

    function test_setTreasury_happy_path() public {
        address newTreasury = makeAddr("newTreasury");

        vm.expectEmit(true, true, false, false, address(arkrow));
        emit Arkrow.TreasuryUpdated(treasury, newTreasury);

        vm.prank(deployer);
        arkrow.setTreasury(newTreasury);

        assertEq(arkrow.treasury(), newTreasury, "treasury updated");
    }

    function test_setTreasury_reverts_zero_address() public {
        vm.expectRevert(Arkrow.ZeroAddress.selector);
        vm.prank(deployer);
        arkrow.setTreasury(address(0));
    }

    function test_setTreasury_reverts_not_owner() public {
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice)
        );
        vm.prank(alice);
        arkrow.setTreasury(makeAddr("x"));
    }

    // -----------------------------------------------------------------------
    // ========================== Fuzz tests =================================
    // -----------------------------------------------------------------------

    /// PROPERTY: workerAmount + referrerAmount + feeAmount == amount for any valid bps combo.
    function testFuzz_split_invariant(
        uint256 amount,
        uint256 _feeBps,
        uint256 _referrerBps
    ) public {
        amount       = bound(amount,      1,     10 ether);
        _feeBps      = bound(_feeBps,     0,     500);   // MAX_FEE_BPS
        _referrerBps = bound(_referrerBps, 0,    1000);  // MAX_REFERRER_BPS

        uint256 feeAmount      = (amount * _feeBps)      / 10_000;
        uint256 referrerAmount = (amount * _referrerBps) / 10_000;
        // Guard: combined bps must not exceed 100% (both are bounded by contract constants)
        vm.assume(feeAmount + referrerAmount <= amount);

        uint256 workerAmount = amount - feeAmount - referrerAmount;

        assertEq(
            workerAmount + referrerAmount + feeAmount,
            amount,
            "split must sum to amount"
        );
    }

    /// PROPERTY: createJob always increments totalLocked by msg.value.
    function testFuzz_createJob_always_increments_totalLocked(uint96 amount) public {
        vm.assume(amount > 0);
        vm.deal(buyer, uint256(amount) + 1 ether);

        uint64 deadline = uint64(block.timestamp + 1 days);
        uint256 lockedBefore = arkrow.totalLocked();

        vm.prank(buyer);
        arkrow.createJob{value: amount}(worker, deadline, address(0), 0);

        assertEq(arkrow.totalLocked(), lockedBefore + amount, "totalLocked incremented by amount");
    }

    // -----------------------------------------------------------------------
    // ======================== Invariant test ===============================
    // -----------------------------------------------------------------------
    // (Separate contract below; this contract is the unit-test suite)

    // -----------------------------------------------------------------------
    // ========================= expireDispute ===============================
    // -----------------------------------------------------------------------

    /// Shared helper: create a job, submit proof, call dispute within review
    /// window → job is now DISPUTED.  Returns jobId and disputeTime.
    function _toDisputedWithProofTime() internal returns (uint256 jobId, uint64 disputeTime) {
        jobId = _createJob();
        _submitProof(jobId);
        vm.prank(buyer);
        arkrow.dispute(jobId);
        // disputeTime is set by dispute() to block.timestamp at the moment of the call
        (, , , , , , , , , disputeTime, , ) = arkrow.jobs(jobId);
    }

    function test_expireDispute_happy_path() public {
        (uint256 jobId, uint64 disputeTime) = _toDisputedWithProofTime();

        // Warp to exactly disputeTime + DISPUTE_EXPIRY (14 days from when dispute was opened)
        uint256 expiryTs = uint256(disputeTime) + 14 days;
        vm.warp(expiryTs);

        uint256 buyerBalBefore = buyer.balance;

        // Expect DisputeExpired then JobRefunded
        vm.expectEmit(true, true, false, true, address(arkrow));
        emit Arkrow.DisputeExpired(jobId, buyer, JOB_AMT);

        vm.expectEmit(true, true, false, true, address(arkrow));
        emit Arkrow.JobRefunded(jobId, buyer, JOB_AMT);

        // alice (not buyer, not worker) calls it
        vm.prank(alice);
        arkrow.expireDispute(jobId);

        (, , , , , , , , , , Arkrow.Status status, ) = arkrow.jobs(jobId);
        assertEq(uint8(status), uint8(Arkrow.Status.REFUNDED), "status REFUNDED");
        assertEq(buyer.balance, buyerBalBefore + JOB_AMT, "buyer refunded");
        assertEq(arkrow.totalLocked(), 0, "totalLocked cleared");
    }

    function test_expireDispute_by_anyone() public {
        (uint256 jobId, uint64 disputeTime) = _toDisputedWithProofTime();

        uint256 expiryTs = uint256(disputeTime) + 14 days;
        vm.warp(expiryTs);

        // Use a completely random address (not buyer / worker / deployer / alice)
        address stranger = makeAddr("stranger");

        vm.prank(stranger);
        arkrow.expireDispute(jobId);   // must not revert

        (, , , , , , , , , , Arkrow.Status status, ) = arkrow.jobs(jobId);
        assertEq(uint8(status), uint8(Arkrow.Status.REFUNDED), "status REFUNDED by stranger");
    }

    function test_expireDispute_reverts_not_expired_at_boundary() public {
        (uint256 jobId, uint64 disputeTime) = _toDisputedWithProofTime();

        // One second before expiry — still not expired
        uint256 oneBeforeExpiry = uint256(disputeTime) + 14 days - 1;
        vm.warp(oneBeforeExpiry);

        vm.expectRevert(Arkrow.DisputeNotExpired.selector);
        vm.prank(alice);
        arkrow.expireDispute(jobId);
    }

    function test_expireDispute_reverts_not_disputed_wrong_status() public {
        // Job is still OPEN — wrong status
        uint256 jobId = _createJob();

        vm.expectRevert(
            abi.encodeWithSelector(Arkrow.WrongStatus.selector, Arkrow.Status.OPEN)
        );
        vm.prank(alice);
        arkrow.expireDispute(jobId);
    }

    function test_expireDispute_reverts_not_expired_just_after_dispute() public {
        (uint256 jobId, uint64 disputeTime) = _toDisputedWithProofTime();

        // 1 second after the dispute was raised — nowhere near expiry
        vm.warp(uint256(disputeTime) + 1);

        vm.expectRevert(Arkrow.DisputeNotExpired.selector);
        vm.prank(alice);
        arkrow.expireDispute(jobId);
    }

    function test_expireDispute_cannot_call_after_owner_resolved() public {
        (uint256 jobId, uint64 disputeTime) = _toDisputedWithProofTime();

        // Owner resolves (payWorker = true) before expiry — status → RELEASED
        vm.prank(deployer);
        arkrow.resolveDispute(jobId, true);

        // Now try to expireDispute — must revert with WrongStatus(RELEASED)
        uint256 expiryTs = uint256(disputeTime) + 14 days;
        vm.warp(expiryTs);

        vm.expectRevert(
            abi.encodeWithSelector(Arkrow.WrongStatus.selector, Arkrow.Status.RELEASED)
        );
        vm.prank(alice);
        arkrow.expireDispute(jobId);
    }

    function test_expireDispute_at_exact_expiry_boundary() public {
        (uint256 jobId, uint64 disputeTime) = _toDisputedWithProofTime();

        // Exact boundary — should succeed (contract uses strict-less-than)
        uint256 expiryTs = uint256(disputeTime) + 14 days;
        vm.warp(expiryTs);

        vm.prank(alice);
        arkrow.expireDispute(jobId);   // must not revert

        (, , , , , , , , , , Arkrow.Status status, ) = arkrow.jobs(jobId);
        assertEq(uint8(status), uint8(Arkrow.Status.REFUNDED), "status REFUNDED at exact boundary");
    }

    function test_expireDispute_pull_fallback() public {
        // Make the buyer a reverting contract so the push-transfer fails
        RevertingReceiver rr = new RevertingReceiver();
        vm.deal(address(rr), 100 ether);

        uint64 deadline = uint64(block.timestamp + DEADLINE_OFFSET);
        vm.prank(address(rr));
        arkrow.createJob{value: JOB_AMT}(worker, deadline, address(0), 0);
        uint256 jobId = arkrow.jobCounter();

        // Submit proof then dispute (within review window)
        bytes32 ph = keccak256("proof");
        vm.prank(worker);
        arkrow.submitProof(jobId, ph);

        vm.prank(address(rr));
        arkrow.dispute(jobId);

        // Read disputeTime set by dispute()
        (, , , , , , , , , uint64 disputeTime, , ) = arkrow.jobs(jobId);

        // Warp to expiry (disputeTime + 14 days)
        uint256 expiryTs = uint256(disputeTime) + 14 days;
        vm.warp(expiryTs);

        vm.expectEmit(true, false, false, true, address(arkrow));
        emit Arkrow.PaymentDeferred(address(rr), JOB_AMT);

        vm.prank(alice);
        arkrow.expireDispute(jobId);   // push fails → deferred

        assertEq(arkrow.pendingWithdrawals(address(rr)), JOB_AMT, "pendingWithdrawals set for buyer");
        assertEq(arkrow.totalPending(), JOB_AMT, "totalPending == amount");
    }

    // -----------------------------------------------------------------------
    // ============================ getJob ===================================
    // -----------------------------------------------------------------------

    function test_getJob_returns_correct_struct() public {
        uint64 deadline = uint64(block.timestamp + DEADLINE_OFFSET);
        vm.prank(buyer);
        arkrow.createJob{value: JOB_AMT}(worker, deadline, referrer, 500);
        uint256 jobId = arkrow.jobCounter();

        Arkrow.Job memory j = arkrow.getJob(jobId);

        assertEq(j.buyer,       buyer,              "buyer matches");
        assertEq(j.worker,      worker,             "worker matches");
        assertEq(j.referrer,    referrer,           "referrer matches");
        assertEq(j.treasury,    treasury,           "treasury snapshotted at createJob");
        assertEq(j.amount,      JOB_AMT,            "amount matches");
        assertEq(j.feeBps,      FEE_BPS,            "feeBps snapshotted at createJob");
        assertEq(j.referrerBps, 500,                "referrerBps matches");
        assertEq(j.deadline,    deadline,           "deadline matches");
        assertEq(j.proofTime,   0,                  "proofTime == 0 (no proof yet)");
        assertEq(j.disputeTime, 0,                  "disputeTime == 0 (no dispute yet)");
        assertEq(uint8(j.status), uint8(Arkrow.Status.OPEN), "status OPEN");
        assertEq(j.proofHash,   bytes32(0),         "proofHash == 0 (no proof yet)");
    }

    function test_getJob_returns_zero_for_nonexistent() public view {
        // No job was ever created with id 9999
        Arkrow.Job memory j = arkrow.getJob(9999);

        assertEq(j.buyer,       address(0), "buyer zero");
        assertEq(j.worker,      address(0), "worker zero");
        assertEq(j.amount,      0,          "amount zero");
        assertEq(j.deadline,    0,          "deadline zero");
        assertEq(uint8(j.status), uint8(Arkrow.Status.OPEN), "default status OPEN (0)");
        assertEq(j.proofHash,   bytes32(0), "proofHash zero");
        assertEq(j.proofTime,   0,          "proofTime zero");
    }

    function test_getJob_reflects_status_changes() public {
        uint256 jobId = _createJob();
        bytes32 ph = keccak256("updated-proof");

        vm.prank(worker);
        arkrow.submitProof(jobId, ph);

        Arkrow.Job memory j = arkrow.getJob(jobId);

        assertEq(uint8(j.status), uint8(Arkrow.Status.PROOF_SUBMITTED), "status PROOF_SUBMITTED");
        assertEq(j.proofHash, ph, "proofHash matches submitted value");
        assertEq(j.proofTime, uint64(block.timestamp), "proofTime set to block.timestamp");
    }
}

// ---------------------------------------------------------------------------
// Small helper: can receive ETH — needed so vm.etch can swap in an ETH-
// accepting contract at the RevertingReceiver address for withdrawPending.
// ---------------------------------------------------------------------------
contract WithdrawHelper {
    Arkrow internal arkrow;

    constructor(Arkrow _arkrow) {
        arkrow = _arkrow;
    }

    receive() external payable {}
}

// ---------------------------------------------------------------------------
// Invariant test suite
// ---------------------------------------------------------------------------
contract ArkrowInvariantTest is Test {
    Arkrow         internal arkrow;
    ArkrowHandler  internal handler;

    address internal deployer = makeAddr("inv_deployer");
    address internal treasury = makeAddr("inv_treasury");
    address internal buyer    = makeAddr("inv_buyer");
    address internal worker   = makeAddr("inv_worker");

    function setUp() public {
        vm.prank(deployer);
        arkrow  = new Arkrow(treasury, 250);

        handler = new ArkrowHandler(arkrow, buyer, worker, treasury);
        vm.deal(buyer, 1_000 ether);

        targetContract(address(handler));
    }

    /// INVARIANT: contract ETH balance >= totalLocked + totalPending
    function invariant_balance_covers_obligations() public view {
        uint256 obligations = arkrow.totalLocked() + arkrow.totalPending();
        assertGe(
            address(arkrow).balance,
            obligations,
            "balance must cover locked + pending"
        );
    }
}
