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
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: |
          Verified via instrumented Playwright trace: after `tryJump()` the physics body's
          velocity.y drops to -1220 and the sprite arcs to a peak of ~346 px above groundY
          (y ~= 574 in game-space; groundY = 920) before falling back and playing the land →
          run transition. Screenshots at 60/180/480/780/1080 ms into the jump show the corgi
          clearly airborne (paws well above the dirt path) at every stage.
          Fixes applied in this iteration:
            1. Guarded `setCorgiTexture` so `sizeCorgiUniform()` (which re-scales the sprite
               and rewrites the arcade body) is no longer called every frame while airborne.
               Previously the same-texture rewrite prevented any scale tween from surviving
               a single tick.
            2. Added a one-shot `playLaunchPop()` squash → stretch → settle scale tween on
               jump initiation for a tactile takeoff pop (physics body untouched).
            3. Added a `spawnJumpPuff()` dust burst at the feet on takeoff so the lift-off is
               visually unmistakable.
          Regression checks:
            - Grounded body-bob still applies via POST_UPDATE (0–3 px oscillation)
            - Landing squash still fires only when `body.velocity.y > 400`
            - Premium corgi outfit textures still persist through jump/land poses.
          Awaiting testing_agent confirmation of jump reliability across multiple taps,
          keyboard SPACE, and paw-button clicks.

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 8
  run_ui: true

test_plan:
  current_focus:
    - "Classic Corgi physical jump — visible lift-off + arc + landing"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

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
