function handleCanvasClick(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;
  mousePos = { x, y };

  if (gameState === "playing") {
    if (isPaused) return;
    performAttack();
    return;
  }

  const hit = uiButtons.find((button) => x >= button.x && x <= button.x + button.w && y >= button.y && y <= button.y + button.h);
  if (hit) hit.onClick();
}

function handleCanvasMove(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  mousePos = { x: (event.clientX - rect.left) * scaleX, y: (event.clientY - rect.top) * scaleY };
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  keys.add(key);
  if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) event.preventDefault();
  if (gameState !== "playing") return;
  if (key === "escape") {
    isPaused = !isPaused;
    return;
  }
  if (isPaused) return;

  if (key.length === 1 && key >= "a" && key <= "z") {
    cheatBuffer = (cheatBuffer + key).slice(-4);
    if (cheatBuffer === "jew") {
      player.money += 999;
      mission.message = "Cheat activated: +999 gold.";
      cheatBuffer = "";
    } else if (cheatBuffer === "pew") {
      player.upgradeLevel += 10;
      mission.message = "Cheat activated: +10 levels.";
      cheatBuffer = "";
    } else if (cheatBuffer === "ride") {
      player.dragonTimer = 600 + player.stats.dragonBonus;
      player.attackCooldown = 0;
      mission.message = "Dragon summoned: fire ride for 10 seconds.";
      cheatBuffer = "";
    } else if (cheatBuffer === "boss") {
      spawnMegaBoss();
      mission.message = "Cheat activated: Mega Boss summoned.";
      cheatBuffer = "";
    }
  }

  if (key === "f") performAttack();
  if (key === "e") performSpecial();
  if (key === "q") tryUpgradeWeapon();
  if (key === "z") cycleBranch();
  if (["1", "2", "3", "4"].includes(key)) buySink(key);
  if (key === "r") performUltimate();
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

canvas.addEventListener("click", handleCanvasClick);
canvas.addEventListener("mousemove", handleCanvasMove);

let previous = performance.now();
function frame(now) {
  const delta = Math.min(2, (now - previous) / 16.6667);
  previous = now;
  worldTime += delta / 60;

  if (gameState === "playing") {
    if (player.health <= 0) respawnPlayer();
    for (let i = 0; i < delta; i += 1) {
      if (isPaused) break;
      if (player.attackCooldown > 0) player.attackCooldown -= 1;
      if (player.ultimateCooldown > 0) player.ultimateCooldown -= 1;
      if (player.specialCooldown > 0) player.specialCooldown -= 1;
      if (player.actionAnim > 0) player.actionAnim -= 1;
      if (player.dragonTimer > 0) player.dragonTimer -= 1;
      torchFlicker = Math.sin(worldTime * 8) * 0.5 + 0.5;
      movePlayer();
      updateProjectiles();
      updateSlashes();
      updateTraps();
      updateCombatEffects();
      updateZombies();
      updateHearts();
      updateWorldEvent();
      handleMission();
    }
  }

  updateUI();
  render();
  requestAnimationFrame(frame);
}

updateUI();
requestAnimationFrame(frame);
