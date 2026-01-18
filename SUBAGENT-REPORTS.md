> now please write a full CLAUDE.md agentic instruction file keeping the following style guide in mind: Prompt Quality Standards

A good subagent prompt is:

- ✅ Specific: No ambiguity about what "done" means
- ✅ Complete: All context needed to start immediately
- ✅ Constrained: Clear boundaries on what NOT to do
- ✅ Structured: Uses XML/markdown for scanability
- ✅ Example-driven: Shows desired patterns when applicable
- ✅ Token-aware: Guides agent to be concise or thorough as needed

A bad subagent prompt is:

- ❌ Vague: "Implement the handler"
- ❌ Context-free: Agent must search blindly for patterns
- ❌ Unconstrained: Agent makes architectural decisions randomly
- ❌ Wall-of-text: No structure, hard to parse
- ❌ Missing success criteria: "Done" is subjective

Examples

    Small, focused task. Be concise but complete.

</example>

</prompt_engineering>

## Subagent Report Format

<report_template>
Every subagent MUST return a concise, structured report:

```xml
<agent_report>
  <task_id><!-- unique identifier --></task_id>
  <status><!-- complete | partial | blocked | failed --></status>

  <work_completed>
    <!-- Bullet list of what was done -->
  </work_completed>

  <outcomes>
    <what_worked><!-- Successes --></what_worked>
    <what_failed><!-- Failures and why --></what_failed>
  </outcomes>

  <incomplete_tasks>
    <!-- If status ≠ complete, what remains -->
  </incomplete_tasks>

  <challenges>
```

⏺ Write(CLAUDE.md)
⎿  Wrote 690 lines to CLAUDE.md

# CLAUDE.md - Farcaster Mini App Development Agent

> Agentic instructions for building viral Farcaster mini apps (frames) with Claude Code

---
## Project Context
<project_overview>
This workspace contains resources for ideating, building, and shipping Farcaster mini apps (formerly Frames V2). Mini apps are embeddable web experiences that run inside Farcaster clients like Warpcast.
… +680 lines (ctrl+o to expand)

⏺ Created comprehensive CLAUDE.md at /Users/samuel/git/dtech-clients/coinbase/miniapp-ideation/CLAUDE.md

What's Included:

Structure

CLAUDE.md
├── Project Context & Repository Structure
├── Core Patterns (4 proven patterns from audit)
├── Tech Stack Standards
├── Subagent Task Templates
│ ├── Quiz Mini App Template
│ ├── NFT Mint Mini App Template
│ └── Leaderboard/Social App Template
├── Frame SDK Quick Reference
├── Neynar API Quick Reference
├── Gemini AI Quick Reference
├── Quality Checklist
├── Subagent Report Format (XML structured)
├── Common Pitfalls to Avoid
├── Reference Implementations (best-in-class links)
├── Quick Start Commands
└── Environment Variables Template

Key Features:

Task Templates - Copy-paste XML specs for common app types with:

- Functional requirements
- Technical requirements
- Files to create
- Success criteria
- "Do not" constraints

Report Format - Standardized XML output:
<agent_report>
<task_id>...</task_id>
<status>complete | partial | blocked | failed</status>
<work_completed>...</work_completed>
<files_created>...</files_created>
<outcomes>...</outcomes>
<next_steps>...</next_steps>
</agent_report>

Quick References - Code snippets for:

- Frame SDK (init, wallet, compose)
- Neynar API (users, casts, search)
- Gemini AI (structured JSON output)

Quality Checklist - Ship-ready validation for:

- Performance
- Mobile UX
- Farcaster integration
- Error handling
- Virality mechanics

> gimme this task template xml Key Features:

Task Templates - Copy-paste XML specs for common app types with:

- Functional requirements
- Technical requirements
- Files to create
- Success criteria
- "Do not" constraints

⏺ Here are the copy-paste XML task templates:
---

1. QUIZ MINI APP TEMPLATE

<task>
    <type>quiz-mini-app</type>
    <name><!-- e.g., "Which Villain Are You?" --></name>

    <requirements>
      <functional>
        - Fetch user profile + last 50 casts via Neynar API
        - Send to Gemini with structured JSON schema
        - Display result with percentage breakdown
        - Generate shareable OG image
        - One-tap share to Warpcast
      </functional>

      <technical>
        - Next.js 15 with App Router
        - Tailwind CSS for styling
        - Edge runtime for API routes
        - Farcaster Frame SDK integration
      </technical>

      <files_to_create>
        - src/app/page.js (main UI)
        - src/app/api/analyze/route.js (Gemini analysis)
        - src/app/api/og/route.js (OG image generation)
        - src/lib/frame.js (SDK initialization)
        - src/lib/neynar.js (user data fetching)
        - src/lib/gemini.js (AI analysis with schema)
      </files_to_create>
    </requirements>

    <ai_prompt_template>
      You are analyzing a Farcaster user to determine [QUIZ_TOPIC].

      User bio: {bio}
      Recent casts: {casts}

      Respond with JSON matching this schema:
      {
        "result": "string (the assigned category)",
        "confidence": "number (0-100)",
        "reasoning": "string (why this result)",
        "breakdown": {
          "category1": number,
          "category2": number
        }
      }
    </ai_prompt_template>

    <success_criteria>
      - [ ] App loads in < 2 seconds
      - [ ] Analysis completes in < 5 seconds
      - [ ] Share button opens Warpcast compose
      - [ ] OG image renders correctly in previews
      - [ ] Mobile responsive (tested at 375px width)
    </success_criteria>

    <do_not>
      - Add authentication beyond Farcaster context
      - Create complex multi-page flows
      - Add features not in requirements
      - Use localStorage for critical state
    </do_not>

</task>

---

2. NFT MINT MINI APP TEMPLATE

<task>
    <type>nft-mint-mini-app</type>
    <name><!-- e.g., "Anime PFP Generator" --></name>

    <requirements>
      <functional>
        - User uploads or uses existing PFP
        - Transform image (if applicable)
        - Connect wallet via Frame SDK
        - Execute mint transaction on Base
        - Display minted NFT with metadata
        - Share achievement to Warpcast
      </functional>

      <technical>
        - Vite + vanilla JS OR Next.js 15
        - viem for blockchain interactions
        - Base Mainnet (chainId: 8453)
        - ERC-721 contract integration
      </technical>

      <files_to_create>
        - src/main.js or src/app/page.js (UI)
        - src/lib/frame.js (SDK + wallet)
        - src/lib/contract.js (mint function)
        - src/components/MintButton.jsx
        - src/components/MintedNFT.jsx
      </files_to_create>
    </requirements>

    <contract_interaction>
      const tx = await sdk.wallet.sendTransaction({
        to: CONTRACT_ADDRESS,
        data: encodeFunctionData({
          abi: NFT_ABI,
          functionName: 'mint',
          args: [userAddress]
        }),
        value: parseEther(MINT_PRICE)
      });
    </contract_interaction>

    <success_criteria>
      - [ ] Wallet connects without errors
      - [ ] Network switches to Base if needed
      - [ ] Transaction submits and confirms
      - [ ] NFT displays after mint
      - [ ] Share button works
    </success_criteria>

    <do_not>
      - Hardcode private keys
      - Skip network validation
      - Ignore transaction errors
      - Make unlimited supply without user knowing
    </do_not>

</task>

---

3. LEADERBOARD / SOCIAL APP TEMPLATE

<task>
    <type>leaderboard-mini-app</type>
    <name><!-- e.g., "Top Casters This Week" --></name>

    <requirements>
      <functional>
        - Fetch activity data (casts, reactions, follows)
        - Calculate rankings based on criteria
        - Display leaderboard with user positions
        - Show user's own rank prominently
        - Enable sharing of rank/position
      </functional>

      <technical>
        - Real-time or periodic data refresh
        - Efficient database queries
        - Pagination for large lists
        - Caching for performance
      </technical>

      <files_to_create>
        - src/app/page.js (leaderboard UI)
        - src/app/api/rankings/route.js (data endpoint)
        - src/components/LeaderboardRow.jsx
        - src/components/UserRank.jsx
        - src/lib/scoring.js (ranking algorithm)
      </files_to_create>
    </requirements>

    <ranking_algorithm_example>
      function calculateScore(user) {
        return (
          user.casts * 1 +
          user.reactions * 0.5 +
          user.replies * 2 +
          user.recasts * 3
        );
      }
    </ranking_algorithm_example>

    <success_criteria>
      - [ ] Leaderboard loads in < 3 seconds
      - [ ] User can find their own rank
      - [ ] Rankings update on refresh
      - [ ] Share includes rank and score
    </success_criteria>

    <do_not>
      - Load entire dataset on client
      - Skip pagination for large lists
      - Expose scoring algorithm to manipulation
      - Cache indefinitely without refresh
    </do_not>

</task>

---

4. COMMERCE / CREATOR MARKETPLACE TEMPLATE

<task>
    <type>commerce-mini-app</type>
    <name><!-- e.g., "Creator Merch Store" --></name>

    <requirements>
      <functional>
        - Creator uploads product/content
        - Sets pricing and commission
        - Publishes to marketplace
        - Buyers can purchase with USDC
        - Creator receives payment automatically
        - Both parties can share transaction
      </functional>

      <technical>
        - Next.js 15 with API routes
        - USDC on Base for payments
        - Database for product listings
        - Image storage (R2/S3)
        - Farcaster auth for creators
      </technical>

      <files_to_create>
        - src/app/page.js (browse/home)
        - src/app/create/page.js (creator flow)
        - src/app/product/[id]/page.js (product detail)
        - src/app/api/products/route.js (CRUD)
        - src/app/api/purchase/route.js (payment)
        - src/components/ProductCard.jsx
        - src/components/CheckoutFlow.jsx
        - src/lib/payments.js (USDC transfer)
      </files_to_create>
    </requirements>

    <payment_flow>
      // USDC transfer on Base
      const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

      const tx = await sdk.wallet.sendTransaction({
        to: USDC_ADDRESS,
        data: encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [creatorAddress, amount]
        })
      });
    </payment_flow>

    <success_criteria>
      - [ ] Creator can list product in < 2 minutes
      - [ ] Buyer checkout completes in 3 taps
      - [ ] Payment verified on-chain
      - [ ] Both parties see confirmation
      - [ ] Share generates with product image
    </success_criteria>

    <do_not>
      - Store payment credentials
      - Skip transaction verification
      - Allow negative pricing
      - Publish without creator confirmation
    </do_not>

</task>

---

5. PFP TRANSFORMATION TEMPLATE

<task>
    <type>pfp-transform-mini-app</type>
    <name><!-- e.g., "Anime-ify Your PFP" --></name>

    <requirements>
      <functional>
        - Fetch user's current Farcaster PFP
        - Send to image transformation API
        - Display before/after comparison
        - Option to mint transformed image as NFT
        - Share result to Warpcast
      </functional>

      <technical>
        - Image generation API (Replicate, Stability, OpenAI)
        - Base64 or URL image handling
        - Canvas for image manipulation (if needed)
        - Optional ERC-721 minting
      </technical>

      <files_to_create>
        - src/app/page.js (main UI with before/after)
        - src/app/api/transform/route.js (image API call)
        - src/app/api/mint/route.js (optional NFT)
        - src/components/ImageComparison.jsx
        - src/components/TransformButton.jsx
        - src/lib/imageApi.js (transformation logic)
      </files_to_create>
    </requirements>

    <image_api_example>
      // Using Replicate for anime transformation
      const output = await replicate.run(
        "cjwbw/anything-v3-better-vae:...",
        {
          input: {
            image: userPfpUrl,
            prompt: "anime style portrait",
            strength: 0.7
          }
        }
      );
    </image_api_example>

    <success_criteria>
      - [ ] PFP fetches automatically from Farcaster
      - [ ] Transformation completes in < 30 seconds
      - [ ] Result quality is shareable
      - [ ] Mint flow works (if included)
      - [ ] Share includes transformed image
    </success_criteria>

    <do_not>
      - Process images larger than 1024x1024
      - Skip loading states during transformation
      - Cache transformed images without permission
      - Expose API keys to client
    </do_not>

</task>

---

6. PREDICTION / BRACKET TEMPLATE

<task>
    <type>prediction-mini-app</type>
    <name><!-- e.g., "World Cup 2026 Bracket" --></name>

    <requirements>
      <functional>
        - Display event/tournament structure
        - User makes predictions/picks
        - Lock predictions before deadline
        - Mint prediction as immutable NFT
        - Compare with friends' predictions
        - Leaderboard after results
      </functional>

      <technical>
        - Database for predictions
        - Timestamp-based locking
        - NFT with prediction metadata
        - Results oracle or manual update
      </technical>

      <files_to_create>
        - src/app/page.js (bracket UI)
        - src/app/api/predict/route.js (save prediction)
        - src/app/api/mint/route.js (NFT with metadata)
        - src/app/api/leaderboard/route.js (after results)
        - src/components/BracketView.jsx
        - src/components/MatchPicker.jsx
        - src/lib/scoring.js (prediction accuracy)
      </files_to_create>
    </requirements>

    <nft_metadata_example>
      {
        "name": "World Cup 2026 Prediction #1234",
        "description": "Locked prediction by @username",
        "attributes": [
          { "trait_type": "Winner Pick", "value": "Brazil" },
          { "trait_type": "Golden Boot", "value": "Mbappe" },
          { "trait_type": "Locked At", "value": "2026-06-01T00:00:00Z" }
        ],
        "image": "ipfs://..."
      }
    </nft_metadata_example>

    <success_criteria>
      - [ ] All matches/events selectable
      - [ ] Predictions lock at deadline
      - [ ] NFT contains all prediction data
      - [ ] Can view friends' predictions post-lock
      - [ ] Leaderboard calculates correctly
    </success_criteria>

    <do_not>
      - Allow prediction changes after lock
      - Reveal others' predictions before deadline
      - Skip deadline validation on server
      - Store predictions only on client
    </do_not>

</task>

---

SUBAGENT REPORT FORMAT

<agent_report>
<task_id><!-- unique identifier, e.g., quiz-villain-001 --></task_id>
<status><!-- complete | partial | blocked | failed --></status>

    <work_completed>
      <!-- Bullet list of what was done -->
      - Created main UI component
      - Implemented API routes
      - Added share functionality
    </work_completed>

    <files_created>
      <!-- List with line counts -->
      - src/app/page.js (142 lines)
      - src/app/api/analyze/route.js (87 lines)
    </files_created>

    <outcomes>
      <what_worked>
        - Gemini returns consistent JSON
        - Share flow opens Warpcast correctly
      </what_worked>
      <what_failed>
        - OG image font rendering issue
      </what_failed>
    </outcomes>

    <testing_notes>
      - Tested with FID 12345 (works)
      - Load time: ~2.1 seconds
    </testing_notes>

    <incomplete_tasks>
      <!-- If status != complete -->
      - Fix OG image font loading
    </incomplete_tasks>

    <blockers>
      <!-- If status == blocked -->
      - Missing API key for service X
    </blockers>

    <next_steps>
      - Deploy to Vercel
      - Test in Warpcast mobile
    </next_steps>

</agent_report>

---

Copy any template above and fill in the <!-- --> placeholders for your specific app!
