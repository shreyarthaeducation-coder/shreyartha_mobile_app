/**
 * constants/partnerTerms.js
 *
 * The Shreyartha Partner Program Terms & Conditions, EXTRACTED BY SCRIPT from
 * frontendmain/src/Partner/PartnerTermsContent.js and verified back word for word — never retyped.
 *
 * THE WORDING IS REVIEWED BY SHREYARTHA LEGAL. Do not paraphrase, reflow or "tidy" anything here.
 * Changing it means changing the web source, the backend constant
 * `PartnerCommissionRates.TERMS_VERSION`, and re-prompting every existing partner to re-accept.
 *
 * The Master Partner commission clause is COMMENTED OUT on the web ("Master Partner tier is
 * paused") and is therefore absent here too. Reviving it means reviving it on the website first.
 *
 * Shape: sections of `{heading, blocks}`, where a block is `{type:'p', text}` or
 * `{type:'ul', items:[{lead?, text}]}`. `lead` is the web's `<strong>` label at the start of a
 * list item — every `<strong>` in the source is exactly that.
 */

export const TERMS_VERSION = "2026-05-v1";
export const TERMS_TITLE = "Shreyartha Partner Program — Terms & Conditions";

export const PARTNER_TERMS = [
  {
    heading: "1. Partnership Scope",
    blocks: [
    { type: 'p', text: "This agreement governs the engagement between Shreyartha and the Partner for the promotion, onboarding, and referral of schools, institutions, parents, and students to Shreyartha's products and services. The Partner operates as an independent contractor and not as an employee, agent, or franchisee of Shreyartha." },
    ],
  },
  {
    heading: "2. Revenue & Commission",
    blocks: [
    {
      type: 'ul',
      items: [
      { lead: "Normal Partner:", text: "25% commission on the student-paid amount, after the 10% student discount applied via the Partner's referral code." },
      { lead: "School (B2B) payouts:", text: "released within 3 (three) business days of successful school onboarding and first invoice collection." },
      { lead: "Direct-to-consumer (B2C) payouts:", text: "released within 15 (fifteen) business days of the end of the refund window for the qualifying transaction." },
      { lead: "TDS:", text: "applicable tax deducted at source under the Income-tax Act, 1961 will be withheld from every payout. A Form 16A certificate will be issued each quarter." },
      { text: "Commission percentages applicable at the time of payment capture are snapshotted onto the earning record and are not retroactively altered by future tier changes." },
      ],
    },
    ],
  },
  {
    heading: "3. Partner Responsibilities",
    blocks: [
    {
      type: 'ul',
      items: [
      { text: "Represent Shreyartha's products honestly and never make claims, guarantees, or commitments beyond official Shreyartha documentation." },
      { text: "Maintain timely communication with Shreyartha and respond to customer queries routed by Shreyartha within 48 hours." },
      { text: "Comply with all applicable Indian laws including GST, TDS, the Information Technology Act, 2000, the Consumer Protection Act, 2019, and the Digital Personal Data Protection Act, 2023." },
      { text: "Keep KYC documentation and bank account details current and accurate." },
      ],
    },
    ],
  },
  {
    heading: "4. Restrictions",
    blocks: [
    {
      type: 'ul',
      items: [
      { text: "No misuse of Shreyartha branding, logos, marketing material, or trademarks beyond the scope provided by Shreyartha in writing." },
      { text: "No paid digital advertising bidding on Shreyartha-owned keywords or domain variants." },
      { text: "No re-sale, sub-licensing, or unauthorised distribution of partner codes." },
      { text: "No solicitation of users away from the Shreyartha platform once a referral has signed up." },
      ],
    },
    ],
  },
  {
    heading: "5. Client & Account Ownership",
    blocks: [
    { type: 'p', text: "All users, schools, parents, and students onboarded through any channel (including Partner referrals) remain the exclusive customers of Shreyartha. The Partner does not acquire any ownership, lien, or residual right over user data, accounts, or future revenue beyond the contractual commission described in clause 2." },
    ],
  },
  {
    heading: "6. Confidentiality",
    blocks: [
    { type: 'p', text: "The Partner shall not disclose any non-public commercial, technical, pricing, roadmap, or user-related information of Shreyartha to any third party during or after the term of this agreement. This clause survives termination indefinitely." },
    ],
  },
  {
    heading: "7. Termination",
    blocks: [
    { type: 'p', text: "Shreyartha may terminate this agreement with immediate effect, and forfeit unpaid commissions, on the occurrence of any of the following:" },
    {
      type: 'ul',
      items: [
      { text: "Misconduct or unprofessional behaviour with users or staff;" },
      { text: "Fraud, chargeback abuse, or self-referral;" },
      { text: "Misrepresentation of Shreyartha products, pricing, or refund policy;" },
      { text: "Misuse of the Shreyartha brand, trademarks, or marketing assets;" },
      { text: "Violation of any clause of this agreement or applicable law." },
      ],
    },
    { type: 'p', text: "Either party may terminate the engagement for convenience with 30 days' written notice. Commissions accrued before termination remain payable subject to the standard refund window." },
    ],
  },
  {
    heading: "8. Changes to Terms",
    blocks: [
    { type: 'p', text: "Shreyartha reserves the right to update these Terms at any time. Partners will be notified via the dashboard and email at least 7 days before changes take effect. Continued use of the Partner Portal after the effective date constitutes acceptance of the updated terms." },
    ],
  },
  {
    heading: "9. Governing Jurisdiction",
    blocks: [
    { type: 'p', text: "This agreement is governed by the laws of India. Any dispute arising out of or in connection with this agreement is subject to the exclusive jurisdiction of the courts at Kolkata, West Bengal." },
    ],
  },
  {
    heading: "Declaration",
    blocks: [
    { type: 'p', text: "By accepting these terms, the Partner acknowledges having read, understood, and agreed to be bound by all clauses above, and confirms that all information provided during registration is true and accurate." },
    ],
  },
];
