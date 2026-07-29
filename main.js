// ============================================================
// CONFIG / CONSTANTS
// ============================================================
const SCORE_THRESHOLD = 150;   // below this, face becomes sad
const SCORE_DECAY = 0.1;       // score lost per frame
const SCORE_BOOST = 10;        // score gained per click
const EYEBAG_REST_Y = 80;      // eye bag resting offset
const EYEBAG_RAISED_Y = 10;    // eye bag offset when "excited"
const EYEBAG_EASE = 0.3;       // lerp speed for eye bag animation
let CHEEK_SIZE_REST; // size of cheeks
let CHEEK_SIZE_PRESSED; // size of cheeks when pressed
const EXCITED_DURATION = 500; // ms the "isUp" state lasts after a click
let button;
let food = ['🥐', '🍕', '🌭', '🍗', '🍙', '🍤', '🍛', '🥟', '🌯', '🍩', '🍪', '🥞', '🧇'];
let currentFood = null; // which emoji is currently "in" the mouth, or null
 
// ============================================================
// STATE
// ============================================================
let score = 100;
let eyeBagYPos, targetEyeBagYPos;
let isUp = false;
let isOpen = false;
 
let leftCheekSize, targetLeftCheekSize, isLeftUp = false;
let rightCheekSize, targetRightCheekSize, isRightUp = false;
 
let cheekHitboxes = [];
let eyeHitboxes = [];
let scoreDisplay = [];
 
let isSadOverride = false;
 
// Random blinking — purely local, each person blinks on their own schedule.
let eyeOpenAmount = 1;   // 1 = fully open, 0 = fully closed
let eyeOpenTarget = 1;
const BLINK_EASE = 0.5;
 
 
// ============================================================
// P5 LIFECYCLE
// ============================================================
function setup() {
    angleMode(DEGREES);
    createCanvas(windowWidth, windowHeight).parent("game-screen");
    document.oncontextmenu = () => false;
 
    CHEEK_SIZE_REST = windowWidth / 5;
    CHEEK_SIZE_PRESSED = windowWidth / 3;
 
    eyeBagYPos = EYEBAG_REST_Y;
    targetEyeBagYPos = EYEBAG_RAISED_Y;
 
    leftCheekSize = CHEEK_SIZE_REST;
    targetLeftCheekSize = CHEEK_SIZE_REST;
    rightCheekSize = CHEEK_SIZE_REST;
    targetRightCheekSize = CHEEK_SIZE_REST;
 
    button = createButton('FEED', 'red');
    button.parent("game-screen");
    button.position(windowWidth / 2 - 128 - 10, 3 * windowHeight / 4)
    button.mousePressed(() => {
            isOpen = true;
            currentFood = random(food);
            score += 50;
            setTimeout(() => {
                isOpen = false;
                currentFood = null;
            }, 500);
    });
    button.addClass('feed-button');
    // Don't animate/decay until a room connection is live.
    noLoop();
}
 
function draw() {
    drawBackground();
    drawFace();
    drawScore();
    updateScore();
    updateEyeBagAnimation();
    updateCheekSizes();
    updateBlink();
}
 
function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    eyeBagYPos = EYEBAG_REST_Y;
    leftCheekSize = CHEEK_SIZE_REST;
    rightCheekSize = CHEEK_SIZE_REST;
}
 
// ============================================================
// DRAWING
// ============================================================
function drawBackground() {
    noStroke();
    background(255, 222, 52);
}
 
function drawFace() {
    fill(0);
    eyes(windowWidth / 2, 100, windowWidth / 10, windowWidth / 4);
    mouth(windowWidth / 2, windowHeight / 2, windowWidth / 7, windowWidth / 15);
 
    fill(255, 170, 102);
    cheeks(windowWidth / 8, windowHeight / 2);
}
 
function cheeks(x, y) {
    fill(255, 170, 102);
    circle(x, y, leftCheekSize);
    circle(7 * x, y, rightCheekSize);
 
    const leftHalf = (leftCheekSize / 2) / Math.sqrt(2);
    const leftBox = leftCheekSize / Math.sqrt(2);
    const rightHalf = (rightCheekSize / 2) / Math.sqrt(2);
    const rightBox = rightCheekSize / Math.sqrt(2);
 
    cheekHitboxes = [
        { x: x - leftHalf, y: y - leftHalf, size: leftBox, side: "left" },
        { x: 7 * x - rightHalf, y: y - rightHalf, size: rightBox, side: "right" }
    ];
}
 
function drawScore() {
    fill(0);
    noStroke();
    text(Math.round(score), 20, 20);
 
    // Popups: show the real value that was stored (with a sign), float
    // upward, fade out, and get removed once they're spent/off-screen.
    textAlign(CENTER, CENTER);
    for (const s of scoreDisplay) {
        s.y -= 1.2;      // float upward
        s.age += 1;
 
        const alpha = map(s.age, 0, s.lifespan, 255, 0, true);
        const isPositive = s.value >= 0;
 
        noStroke();
        fill(isPositive ? [40, 200, 90, alpha] : [220, 60, 60, alpha]);
        text((isPositive ? "+" : "") + s.value, s.x, s.y);
    }
    textAlign(LEFT, BASELINE); // restore default for drawScore()'s own text() call above
 
    // Clean up expired popups so the array doesn't grow forever.
    scoreDisplay = scoreDisplay.filter((s) => s.age < s.lifespan);
}
 
function eyes(x, y, size, gap) {
    const leftX = x - gap / 2;
    const rightX = x + gap / 2;
 
    fill(0);
    ellipse(leftX, y, size, size * eyeOpenAmount);
    ellipse(rightX, y, size, size * eyeOpenAmount);
 
    drawPupil(leftX, y, size);
    drawPupil(rightX, y, size);
 
    fill(255, 214, 0);
    arc(leftX, y + eyeBagYPos, size + 10, size + 10, 0, 180);
    arc(rightX, y + eyeBagYPos, size + 10, size + 10, 0, 180);
 
    eyeHitboxes = [
        { x: leftX - (size / 2) / Math.sqrt(2), y: y - (size / 2) / Math.sqrt(2), size: size / Math.sqrt(2), side: "left" },
        { x: rightX - (size / 2) / Math.sqrt(2), y: y - (size / 2) / Math.sqrt(2), size: size / Math.sqrt(2), side: "right" }
    ];
}
 
// Purely a local visual effect — each person's pupils follow their own
// cursor only. Nothing here needs to be sent over the network.
function drawPupil(eyeX, eyeY, eyeSize) {
    const pupilSize = eyeSize * 0.35;
    const maxOffset = eyeSize / 2 - pupilSize / 2 - 4;
 
    const angle = atan2(mouseY - eyeY, mouseX - eyeX);
    const pupilX = eyeX + cos(angle) * maxOffset;
    const pupilY = eyeY + sin(angle) * maxOffset;
 
    fill(255);
    ellipse(pupilX, pupilY, pupilSize, pupilSize * eyeOpenAmount);
}
 
function mouth(x, y, size, width) {
    const isHappy = !isSadOverride && score > SCORE_THRESHOLD;
    const outerStart = isHappy ? 0 : 180;
    const outerEnd = isHappy ? 180 : 0;
    const innerYOffset = isHappy ? -0.5 : 0.5;
 
    if (isOpen === false) {
    fill(0);
    arc(x, y, size, size, outerStart, outerEnd);
 
    fill(255, 222, 52);
    arc(x, y + innerYOffset, size - width, size - width, outerStart, outerEnd);
    } else if (isOpen === true){
        fill(0);
        circle(x, y, width * 2);
 
        if (currentFood) {
            // push()/pop() so textSize/textAlign here don't bleed into
            // drawScore()'s own text() calls later in the same frame.
            push();
            textAlign(CENTER, CENTER);
            textSize(width * 0.5);
            text(currentFood, x, y);
            pop();
        }
    }
}
 
 
// ============================================================
// UPDATE / ANIMATION LOGIC
// ============================================================
function updateScore() {
    score -= SCORE_DECAY;
    score = constrain(score, 0, 999999999999999999);
}
 
function updateEyeBagAnimation() {
    targetEyeBagYPos = isUp ? EYEBAG_RAISED_Y : EYEBAG_REST_Y;
    eyeBagYPos = lerp(eyeBagYPos, targetEyeBagYPos, EYEBAG_EASE);
}
 
function updateBlink() {
    eyeOpenAmount = lerp(eyeOpenAmount, eyeOpenTarget, BLINK_EASE);
}
 
function updateCheekSizes() {
    targetLeftCheekSize = isLeftUp ? CHEEK_SIZE_PRESSED : CHEEK_SIZE_REST;
    leftCheekSize = lerp(leftCheekSize, targetLeftCheekSize, EYEBAG_EASE);
 
    targetRightCheekSize = isRightUp ? CHEEK_SIZE_PRESSED : CHEEK_SIZE_REST;
    rightCheekSize = lerp(rightCheekSize, targetRightCheekSize, EYEBAG_EASE);
}
 
// ============================================================
// SHARED ACTION HANDLING (local clicks + remote clicks both flow through here)
// ============================================================
// action is a plain object like { type: "general" } | { type: "cheek", side: "left" } | { type: "eye" }
// Returns the score delta this action caused, so callers (like the popup
// text) can display the real amount instead of assuming it's always +10.
function applyAction(action) {
    if (action.type === "general") {
        score += SCORE_BOOST;
        isUp = true;
        setTimeout(() => { isUp = false; }, EXCITED_DURATION);
        return SCORE_BOOST;
    } else if (action.type === "cheek") {
        score += SCORE_BOOST;
        if (action.side === "left") {
            isLeftUp = true;
            setTimeout(() => { isLeftUp = false; }, EXCITED_DURATION);
        } else if (action.side === "right") {
            isRightUp = true;
            setTimeout(() => { isRightUp = false; }, EXCITED_DURATION);
        }
        return SCORE_BOOST;
    } else if (action.type === "eye") {
        isSadOverride = true;
        score -= 2 * SCORE_BOOST;
        setTimeout(() => { isSadOverride = false; }, 1000);
        return -2 * SCORE_BOOST;
    }
    return 0;
}
 
//feeding button
 
// Creates a floating +N/-N popup at a given position. Used for the local
// player's own clicks (real cursor position) and for actions that arrive
// from other people in the room (no cursor position available, so callers
// pass a sensible default like the score counter's location).
function showScorePopup(value, x, y) {
    scoreDisplay.push({ value, x, y, age: 0, lifespan: 60 });
}
 
// Called by lobby.js once a peer connection is live.
function startSharedFace() {
    loop();
    scheduleNextBlink();
}
 
// Purely a local visual effect — schedules the next random blink for this
// person only. Not synchronized with anyone else in the room.
function scheduleNextBlink() {
    const delay = random(2000, 6000); // wait 2-6s before the next blink
    setTimeout(() => {
        eyeOpenTarget = 0; // start closing
        setTimeout(() => {
            eyeOpenTarget = 1; // open back up
            scheduleNextBlink();
        }, 110); // how long the eyes stay shut
    }, delay);
}
 
// Called by lobby.js when the host sends a periodic authoritative score sync.
function receiveScoreSync(hostScore) {
    score = hostScore;
}
 
// ============================================================
// EVENT HANDLERS
// ============================================================
function mousePressed(event) {
    if (mouseButton !== LEFT) return;
    // Ignore clicks while still in the lobby (canvas is hidden but p5 keeps listening).
    if (typeof window.roomConnected === "undefined" || !window.roomConnected) return;
 
    // p5 fires this global mousePressed() for ANY mousedown on the page,
    // including clicks on the button (its listener is attached at the
    // document level, not scoped to the canvas). So pressing the button
    // also reaches this function — check the actual DOM click target and
    // bail out before any scoring happens if it wasn't the face/canvas.
    if (event && button && event.target === button.elt) return;
 
    // Matches the original logic exactly: every click always gives the
    // general "excited" bounce, PLUS extra effects if it also lands on a
    // cheek or eye hitbox. We collect all triggered actions so they can be
    // applied locally and broadcast to everyone else in the room in one go.
    const actions = [{ type: "general" }];
 
    for (const box of cheekHitboxes) {
        if (mouseX > box.x && mouseX < box.x + box.size && mouseY > box.y && mouseY < box.y + box.size) {
            actions.push({ type: "cheek", side: box.side });
        }
    }
 
    for (const box of eyeHitboxes) {
        if (mouseX > box.x && mouseX < box.x + box.size && mouseY > box.y && mouseY < box.y + box.size) {
            actions.push({ type: "eye" });
        }
    }
 
    // Apply every triggered action and add up the real total delta so the
    // popup shows what actually happened (e.g. +20 for a cheek hit, -10 net
    // for hitting an eye), not just a hardcoded +10.
    let totalDelta = 0;
    for (const action of actions) totalDelta += applyAction(action);
 
    showScorePopup(totalDelta, mouseX, mouseY);
 
    window.sendRoomAction && window.sendRoomAction(actions);
}