const buildingImage = new Image();
buildingImage.src = "building-background.jpg";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreElement = document.getElementById("score");
const bestElement = document.getElementById("best");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const startButton = document.getElementById("startButton");
const flapButton = document.getElementById("flapButton");

// Audio files - filenames unchanged
const flapSound = new Audio("flap.mp3");
const collisionSound = new Audio("Moan anime.mp3.mpeg");

flapSound.preload = "auto";
collisionSound.preload = "auto";
flapSound.volume = 0.7;
collisionSound.volume = 0.8;

function playSound(sound) {
  try {
    sound.currentTime = 0;
    const playback = sound.play();
    if (playback && typeof playback.catch === "function") {
      playback.catch(error => {
        console.warn("Audio could not play:", error);
      });
    }
  } catch (error) {
    console.warn("Audio playback error:", error);
  }
}

function playJumpSound() {
  playSound(flapSound);
}

// Built-in collision sound fallback
let gameAudioContext = null;

function unlockGameAudio() {
  const AudioContextClass =
    window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) return;

  if (!gameAudioContext) {
    gameAudioContext = new AudioContextClass();
  }

  if (gameAudioContext.state === "suspended") {
    gameAudioContext.resume().catch(() => {});
  }
}

function playBuiltInCollisionSound() {
  try {
    unlockGameAudio();
    if (!gameAudioContext) return;

    const now = gameAudioContext.currentTime;
    const oscillator = gameAudioContext.createOscillator();
    const gain = gameAudioContext.createGain();

    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(260, now);
    oscillator.frequency.exponentialRampToValueAtTime(75, now + 0.32);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);

    oscillator.connect(gain);
    gain.connect(gameAudioContext.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.38);
  } catch (error) {
    console.warn("Built-in collision sound could not play:", error);
  }
}

function playCollisionSound() {
  if (
    collisionSound.error ||
    collisionSound.networkState === HTMLMediaElement.NETWORK_NO_SOURCE
  ) {
    playBuiltInCollisionSound();
    return;
  }

  try {
    collisionSound.currentTime = 0;
    const playback = collisionSound.play();

    if (playback && typeof playback.catch === "function") {
      playback.catch(() => playBuiltInCollisionSound());
    }
  } catch (error) {
    playBuiltInCollisionSound();
  }
}

// Canvas dimensions
let WIDTH = 960;
let HEIGHT = 540;
let GROUND = 510;
let isMobilePortrait = false;

// CUSTOMIZE GAME SETTINGS
const SETTINGS = {
  gravity: 0.27,
  jumpStrength: -5.5,
  pipeSpeed: 3.0,
  pipeWidth: 65,
  pipeGap: 150,
  pipeInterval: 20,
  birdColor: "#f7ca53",
  obstacleColor: "#55bd67",
  movingObstacles: true
};

// Game variables
let state = "ready";
let score = 0;
let best = 0;
let frame = 0;

let bird = {
  x: 185,
  y: 250,
  velocity: 0,
  rotation: 0
};

let pipes = [];

let clouds = [
  { x: 30, y: 90, size: 1 },
  { x: 245, y: 150, size: 0.8 },
  { x: 350, y: 55, size: 0.65 }
];

// Resize game for mobile and desktop
function resizeGame() {
  isMobilePortrait = window.matchMedia(
    "(max-width: 768px) and (orientation: portrait)"
  ).matches;

  if (isMobilePortrait) {
    WIDTH = 540;
    HEIGHT = 900;
    GROUND = 842;

    SETTINGS.pipeWidth = 76;
    SETTINGS.pipeGap = 120;
    SETTINGS.pipeSpeed = 4.0;
    SETTINGS.pipeInterval = 19;

    SETTINGS.gravity = 0.52;
    SETTINGS.jumpStrength = -9.2;

  } else {
    WIDTH = 960;
    HEIGHT = 540;
    GROUND = 510;

    SETTINGS.pipeWidth = 65;
    SETTINGS.pipeGap = 120;
    SETTINGS.pipeSpeed = 4.0;
    SETTINGS.pipeInterval = 20;

    SETTINGS.gravity = 0.52;
    SETTINGS.jumpStrength = -5.5;
  }

  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  bird.x = isMobilePortrait ? 135 : 185;

  if (state !== "playing") {
    bird.y = HEIGHT * 0.46;
  }
}

window.addEventListener("resize", resizeGame);

window.addEventListener("orientationchange", () => {
  window.setTimeout(resizeGame, 120);
});

// Load saved high score
try {
  best = Number(localStorage.getItem("flappyFriendsBest")) || 0;
} catch (error) {
  best = 0;
}

bestElement.textContent = best;

// Draw background
function drawBackground() {
  if (buildingImage.complete && buildingImage.naturalWidth > 0) {
    const imageRatio =
      buildingImage.naturalWidth / buildingImage.naturalHeight;

    const canvasRatio = WIDTH / HEIGHT;

    let sx = 0;
    let sy = 0;
    let sw = buildingImage.naturalWidth;
    let sh = buildingImage.naturalHeight;

    if (imageRatio > canvasRatio) {
      sw = buildingImage.naturalHeight * canvasRatio;
      sx = (buildingImage.naturalWidth - sw) / 2;
    } else {
      sh = buildingImage.naturalWidth / canvasRatio;
      sy = (buildingImage.naturalHeight - sh) / 2;
    }

    ctx.drawImage(
      buildingImage,
      sx, sy, sw, sh,
      0, 0, WIDTH, HEIGHT
    );

  } else {
    const fallback = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    fallback.addColorStop(0, "#75d6f4");
    fallback.addColorStop(1, "#d4f7e8");

    ctx.fillStyle = fallback;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  ctx.fillStyle = "rgba(255,255,255,0.20)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  clouds.forEach(cloud => {
    drawCloud(cloud.x, cloud.y, cloud.size);

    if (state === "playing") cloud.x -= 0.25;
    if (cloud.x < -65) cloud.x = WIDTH + 50;
  });

  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(0, GROUND, WIDTH, HEIGHT - GROUND);
}

function drawCloud(x, y, size) {
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.beginPath();

  ctx.arc(x, y, 17 * size, 0, Math.PI * 2);
  ctx.arc(x + 19 * size, y - 9 * size, 22 * size, 0, Math.PI * 2);
  ctx.arc(x + 43 * size, y, 16 * size, 0, Math.PI * 2);

  ctx.fill();
}

// Load game images
const capsuleImage = new Image();
capsuleImage.src = "capsule-obstacle.png";

const birdImage = new Image();
birdImage.src = "custom-bird.png";

// Draw bird
function drawBird() {
  ctx.save();
  ctx.translate(bird.x, bird.y);
  ctx.rotate(bird.rotation);

  if (birdImage.complete && birdImage.naturalWidth > 0) {
    const birdSize = isMobilePortrait ? 66 : 52;

    ctx.drawImage(
      birdImage,
      -birdSize / 2,
      -birdSize / 2,
      birdSize,
      birdSize
    );

  } else {
    ctx.fillStyle = SETTINGS.birdColor;
    ctx.beginPath();
    ctx.arc(0, 0, isMobilePortrait ? 25 : 20, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// Draw capsules
function drawPipe(pipe) {
  const gap = SETTINGS.pipeGap;
  const topEnd = pipe.gapY - gap / 2;
  const bottomStart = pipe.gapY + gap / 2;
  const w = SETTINGS.pipeWidth;

  const topHeight = Math.max(0, topEnd + 12);
  const bottomHeight = Math.max(0, GROUND - bottomStart + 12);

  if (capsuleImage.complete && capsuleImage.naturalWidth > 0) {

    ctx.save();
    ctx.translate(pipe.x + w / 2, topHeight / 2);
    ctx.scale(1, -1);

    ctx.drawImage(
      capsuleImage,
      -w / 2,
      -topHeight / 2,
      w,
      topHeight
    );

    ctx.restore();

    ctx.drawImage(
      capsuleImage,
      pipe.x,
      bottomStart - 12,
      w,
      bottomHeight
    );

  } else {
    roundedRect(pipe.x, 0, w, topEnd + 12, w / 2, "#d91f3c");

    roundedRect(
      pipe.x,
      bottomStart - 12,
      w,
      GROUND - bottomStart + 12,
      w / 2,
      "#d91f3c"
    );
  }
}

function roundedRect(x, y, w, h, radius, color) {
  if (w <= 0 || h <= 0) return;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
}

// Start game
function startGame() {
  unlockGameAudio();

  collisionSound.pause();
  collisionSound.currentTime = 0;

  state = "playing";
  score = 0;
  frame = 0;
  pipes = [];

  bird = {
    x: isMobilePortrait ? 135 : 185,
    y: HEIGHT * 0.46,
    velocity: SETTINGS.jumpStrength,
    rotation: 0
  };

  scoreElement.textContent = "0";
  overlay.classList.add("hidden");
}

// Bird jump
function flap() {
  unlockGameAudio();

  if (state === "ready") {
    startGame();
  }

  if (state === "over") {
    return;
  }

  bird.velocity = SETTINGS.jumpStrength;
  playJumpSound();

  // 100 points per jump
  score += 100;
  scoreElement.textContent = score;

  if (score > best) {
    best = score;
    bestElement.textContent = best;

    try {
      localStorage.setItem("flappyFriendsBest", best);
    } catch (error) {
      console.log("Could not save high score.");
    }
  }
}

// Game over
function gameOver() {
  if (state !== "playing") return;

  state = "over";
  playCollisionSound();

  overlayTitle.textContent = "Oh No! 😢";
  overlayText.textContent = "Your score: " + score;
  startButton.textContent = "↻ Play Again";

  overlay.classList.remove("hidden");
}

// Create capsule pair
function createPipe() {
  pipes.push({
    x: WIDTH + 20,

    gapY: isMobilePortrait
      ? Math.random() * 250 + 325
      : Math.random() * 130 + 185,

    phase: Math.random() * 7,
    passed: false
  });
}

// Collision detection
function checkCollision(pipe) {
  const bx = bird.x;
  const by = bird.y;

  const hitRadius = isMobilePortrait ? 19 : 13;

  if (
    by - hitRadius < 0 ||
    by + hitRadius > GROUND
  ) {
    return true;
  }

  if (
    bx + (isMobilePortrait ? 20 : 15) > pipe.x &&
    bx - (isMobilePortrait ? 20 : 15) <
      pipe.x + SETTINGS.pipeWidth
  ) {
    const gapTop = pipe.gapY - SETTINGS.pipeGap / 2;
    const gapBottom = pipe.gapY + SETTINGS.pipeGap / 2;

    if (
      by - hitRadius < gapTop ||
      by + hitRadius > gapBottom
    ) {
      return true;
    }
  }

  return false;
}

// Update score for passing capsules
function updateScore(pipe) {
  if (
    !pipe.passed &&
    pipe.x + SETTINGS.pipeWidth < bird.x
  ) {
    pipe.passed = true;

    score++;
    scoreElement.textContent = score;

    if (score > best) {
      best = score;
      bestElement.textContent = best;

      try {
        localStorage.setItem("flappyFriendsBest", best);
      } catch (error) {
        console.log("Could not save high score.");
      }
    }
  }
}

// Update game
function update() {
  frame++;

  bird.velocity += SETTINGS.gravity;

  bird.y += bird.velocity;

  bird.rotation = Math.min(
    0.8,
    Math.max(-0.5, bird.velocity * 0.09)
  );

  // ONLY CHANGE: mobile pair interval is 19 frames.
  if (frame % SETTINGS.pipeInterval === 0) {
    createPipe();
  }

  pipes.forEach(pipe => {
    pipe.x -= SETTINGS.pipeSpeed;

    if (SETTINGS.movingObstacles) {
      pipe.gapY +=
        Math.sin(frame * 0.025 + pipe.phase) * 0.48;
    }

    if (checkCollision(pipe)) {
      gameOver();
    }

    updateScore(pipe);
  });

  pipes = pipes.filter(pipe => pipe.x > -85);
}

// Render game
function draw() {
  drawBackground();

  pipes.forEach(drawPipe);

  drawBird();
}

// Main game loop
function gameLoop() {
  if (state === "playing") {
    update();
  }

  if (state === "ready") {
    bird.y =
      HEIGHT * 0.46 + Math.sin(Date.now() * 0.003) * 10;

    bird.rotation = 0;
  }

  draw();

  requestAnimationFrame(gameLoop);
}

// Controls
startButton.addEventListener("click", startGame);
flapButton.addEventListener("click", flap);

canvas.addEventListener("pointerdown", event => {
  event.preventDefault();
  flap();
});

window.addEventListener("keydown", event => {
  if (
    event.code === "Space" ||
    event.code === "ArrowUp"
  ) {
    event.preventDefault();
    flap();
  }
});

// Set correct dimensions
resizeGame();

// Start rendering
requestAnimationFrame(gameLoop);
