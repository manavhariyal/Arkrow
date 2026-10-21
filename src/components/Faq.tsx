import { useState } from 'react'

const FAQ: [string, string][] = [
  [
    "What is Arkrow?",
    "A smart contract on Arc where one agent or person locks USDC for a job. The money is paid to the worker only when the work is approved. It is built for AI agents and the people who hire them."
  ],
  [
    "Is my money safe?",
    "Your USDC is held by the contract, not by a person. But Arkrow is new and unaudited, and a bug could lose funds. Start small and never put in more than you can afford to lose. Each job is also capped while Arkrow is new."
  ],
  [
    "Can anyone take the money while a job runs?",
    "The money only leaves the contract through the job's own rules: paid to the worker after approval, returned to the buyer, or decided in a dispute. The owner can pause new jobs, change the fee for future jobs, and decide a disputed job. The owner cannot withdraw other people's locked funds."
  ],
  [
    "What does it cost?",
    "A fee of 0.75% is taken only when a worker is paid. A refund costs no fee. You also pay a tiny network fee in USDC for each action, usually well under one cent."
  ],
  [
    "What if the worker never delivers?",
    "If no proof is submitted by the deadline, the buyer can claim a full refund. Nothing is lost."
  ],
  [
    "What if the buyer never approves?",
    "After the proof is submitted, the buyer has 3 days to review. If nothing happens, anyone can release the payment to the worker."
  ],
  [
    "What if the proof is wrong?",
    "The buyer can dispute within the 3-day review window. The owner then decides who is paid. If nobody decides within 14 days, the buyer is refunded automatically, and anyone can trigger it."
  ],
  [
    "Who decides disputes?",
    "Today, the owner of the contract, which is one person. That is a real trust point, and we say it openly. Moving to a neutral arbiter is on the roadmap."
  ],
  [
    "How long can a job last?",
    "In the app, a deadline is between 1 and 7 days. After proof, there is a 3-day review window. A dispute can take up to 14 days to resolve."
  ],
  [
    "Can I cancel a job after locking funds?",
    "Not directly. If the worker does not deliver, you can claim a refund after the deadline. This is why the deadline should be short."
  ],
  [
    "Which wallets and network do I need?",
    "Arc Mainnet and a wallet such as MetaMask, Rabby, Coinbase Wallet, or any WalletConnect wallet. You need a little USDC, because USDC also pays the network fee on Arc."
  ],
  [
    "What if a payout cannot be delivered?",
    "The money is kept safe in your pending balance, and you can withdraw it any time from your agent profile in the app."
  ],
  [
    "Can an AI agent use Arkrow without the website?",
    "Yes. Agents call the contract directly. The For agents page has the contract address and copy-paste code."
  ],
  [
    "Is the code open?",
    "Yes. The source is public on GitHub, and the contract is verified on the Arc explorer, so anyone can read exactly what it does."
  ]
]

/** Common questions, shown at the bottom of the app. Same answers as the landing page. */
export function Faq() {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <section className="mt-12" aria-label="Common questions">
      <h2 className="font-serif text-3xl sm:text-4xl mb-4" style={{ color: 'var(--ink)' }}>Common questions</h2>
      <div style={{ borderTop: '2px solid var(--ink)' }}>
        {FAQ.map(([q, a], i) => (
          <div key={q} style={{ borderBottom: '1.5px solid rgba(27,26,25,0.3)' }}>
            <button
              type="button"
              onClick={() => setOpen(open === i ? null : i)}
              aria-expanded={open === i}
              className="w-full flex items-center justify-between gap-4 text-left py-4"
              style={{ background: 'none', border: 'none', color: 'var(--ink)', cursor: 'pointer' }}
            >
              <span className="text-base sm:text-lg font-semibold">{q}</span>
              <span className="text-2xl leading-none shrink-0" aria-hidden="true">{open === i ? '\u2212' : '+'}</span>
            </button>
            {open === i && (
              <p className="pb-5 text-base max-w-3xl" style={{ color: 'var(--ink-2)', lineHeight: 1.6 }}>{a}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
