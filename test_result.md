#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Rebuild "Corgi Hop" as a full-screen 2D casual mobile game rendered inside a Phaser 3 WebGL
  canvas, packaged with Capacitor for native builds. Requirements: AI-generated original assets,
  real mobile monetization (AdMob rewarded/interstitial + RevenueCat IAP), one-tap jumping,
  progressive speed, treats, polished casual-game aesthetic. The latest user command is to
  guarantee that the Classic Corgi *physically* leaves the ground when jumping — visible space
  beneath the paws — instead of any animation-only trick.

frontend:
  - task: "Classic Corgi physical jump — visible lift-off + arc + landing"
    implemented: true
    working: true
    file: "/app/frontend/src/game/scenes/GameScene.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: |
          Verified via instrumented Playwright trace: after `tryJump()` the physics body's
          velocity.y drops to -1220 and the sprite arcs to a peak of ~346 px above groundY
          before landing cleanly. Launch-pop + jump-puff added for visual tactility.
      - working: true
        agent: "testing"
        comment: |
          Confirmed in iteration_8: jump peak ≥ 300 px, texture sequence
          run → jump → fall → land → run intact, no regressions.

  - task: "Per-corgi 8-frame run animations — Classic + 5 premium sheets"
    implemented: true
    working: true
    file: "/app/frontend/src/game/scenes/GameScene.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: |
          Generated 5 dedicated 8-frame run sprite sheets via Gemini Nano Banana
          (gemini-3.1-flash-image-preview) at 2928×352 (identical to Classic dims). Each
          sheet uses that corgi's OWN outfit — Starter (teal collar + star tag), Cowboy
          (hat + bandana), Superhero (mask + cape), Pirate (tricorn + skull), Astronaut
          (helmet + backpack). All sheets stripped of the baked checkerboard bg via
          scripts/strip_checker_bg.py and verified against light + dark composites.

          Integration:
          - PreloadScene loads 5 new spritesheets (starter_run, cowboy_run, superhero_run,
            pirate_run, astronaut_run) with frameWidth 366, frameHeight 352.
          - PreloadScene registers 5 new animations at 14 fps (retimed per-tick by
            syncRunTiming based on gameSpeed).
          - GameState.CORGIS gained runSheetKey / runAnimKey / jumpFrame / fallFrame /
            landFrame per corgi so state transitions consume the correct assets.
          - GameScene captures runTexKey + runAnimKey on create, then setPose('run'/
            'jump'/'fall'/'land'/'hit') routes every state transition through the
            corgi's OWN sheet. Classic still uses its dedicated jump/fall/land PNGs;
            premium corgis freeze on their own tuned frame (jumpFrame=4, fallFrame=6,
            landFrame=0) so the outfit stays visible.

          Live browser verification (screenshot per corgi):
            classic   → runAnimKey='run',           corgi_run
            starter   → runAnimKey='starter_run',   starter_run
            cowboy    → runAnimKey='cowboy_run',    cowboy_run
            superhero → runAnimKey='superhero_run', superhero_run
            pirate    → runAnimKey='pirate_run',    pirate_run
            astronaut → runAnimKey='astronaut_run', astronaut_run
          Every corgi shows animPlaying: True.

          Awaiting testing_agent confirmation of:
            - Each corgi's run/jump/fall/land poses visually correct with the outfit
              preserved
            - Each corgi cleared its required hurdle count (Classic 50, others 20 each)
            - Persistence: selected corgi survives restart / menu / pause / revive

  - task: "Physics-validated HurdleGenerator + 10 000-sequence validator"
    implemented: true
    working: true
    file: "/app/frontend/src/game/systems/HurdleGenerator.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: |
          Extracted spawn logic into a shared TypeScript module. Every candidate is
          validated against the LIVE physics constants (jumpVelocity=-1220, worldGravity=
          2400, asymmetric gravity ±400/+1000, speedRampK=8, dogColliderW=120) before
          being emitted. Rejection reasons include: height > 55% of peakPx, cluster span
          > 85% of horizontal jump range, fence overlap, insufficient runway to next
          group, reaction window below tier minimum (450/350/275/220/200 ms).
          Ran scripts/validate_hurdles.mjs: 10 000 sequences × 30 obstacles =
          300 000 candidates, ZERO impossible / failing sequences, ZERO fallback
          spawns. Height range 70–170 px, width 56–130 px, spacing 1162–1418 px,
          reaction 754–1795 ms. All 5 difficulty tiers exercised.

  - task: "Milestone feedback at 10/25/50/75/100 + new-best banner"
    implemented: true
    working: true
    file: "/app/frontend/src/game/scenes/HUDScene.ts"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: |
          Added tasteful banner + confetti burst on scoreChanged events at
          10 / 25 / 50 / 75 / 100. New-best celebration fires once when the current run
          crosses gameState.bestScore + 1. Non-blocking overlay at y=260, does not cover
          the corgi or the paw button. Copy: "NICE! 10 HOPS", "25 HOPS!", "HALF CENTURY!",
          "ON FIRE!", "LEGENDARY!". Confetti uses 24 particles with 5-colour tint
          rotation, gravity 480, auto-destroyed after 1.4 s.

metadata:
  created_by: "main_agent"
  version: "1.1"
  test_sequence: 9
  run_ui: true

test_plan:
  current_focus:
    - "Per-corgi 8-frame run animations — Classic + 5 premium sheets"
    - "Milestone feedback at 10/25/50/75/100 + new-best banner"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Iteration 9 delivered:
        1. 5 premium corgi run sprite sheets generated via Gemini Nano Banana
           (approved one-by-one by user).
        2. Full per-corgi animation namespaces integrated (starter_run / cowboy_run /
           superhero_run / pirate_run / astronaut_run). Every corgi now has real
           8-frame leg cycles + Classic's state machine.
        3. HurdleGenerator refactored into a shared, physics-validated module with a
           10 000-sequence Node validator (0 failures). GameScene now spawns from it.
        4. Milestone banners at 10 / 25 / 50 / 75 / 100 + new-best celebration.

      Please verify (frontend only, no backend):
        1. Each of the 6 corgis loads its OWN texture + animation at game start
           (localStorage.corgihop:selected_corgi drives the choice).
        2. Every corgi visibly runs with alternating legs, jumps physically off the
           ground (peak ≥ 100 px), lands, and returns to run.
        3. Selected outfit accessories (collar+tag / hat+bandana / mask+cape / tricorn+
           skull / helmet+backpack) remain visible in run + airborne + landing poses.
        4. No corgi shows Classic art as a substitute.
        5. No console errors.
        6. Milestone banners fire at scores 10 / 25 / 50 / 75 / 100 without pausing.
        7. New-best celebration appears once when the run crosses the previous best.
        8. Restart, pause/resume, and menu-return preserve the selected corgi.

agent_communication:
  - agent: "main"
    message: |
      Physical jump verified working. Corgi peaks at ~346 px above groundY with clean
      run → jump → fall → land → run transitions. Requesting testing_agent to:
        1. Confirm the paw button (bottom-center) reliably triggers jumps on multiple taps.
        2. Confirm keyboard SPACE / UP arrow also trigger jumps.
        3. Confirm the corgi visibly leaves the ground (measurable gap between paws and
           the dirt path) during the ascent + peak of every jump.
        4. Confirm the corgi lands cleanly and returns to the run animation without visual
           regression (no rocking, no scale drift, no stuck poses).
        5. Confirm the "launch pop" scale tween + dust puff burst appear on takeoff.
      No backend changes in this iteration. Test frontend only.
