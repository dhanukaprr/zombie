function facingFromAngle(angle) {
  const x = Math.cos(angle || 0);
  const y = Math.sin(angle || 0);
  if (Math.abs(y) > Math.abs(x)) return y > 0 ? "down" : "up";
  return x > 0 ? "right" : "left";
}

function drawHuman(entity, spriteSet, camera, scale = 1) {
  const facing = facingFromAngle(entity.angle ?? entity.dir ?? 0);
  const frame = Math.floor(entity.anim || 0) % 3;
  const sprite = facing === "left" ? spriteSet.right[frame] : spriteSet[facing][frame];
  const drawX = Math.floor(entity.x - camera.x - 12 * scale);
  const drawY = Math.floor(entity.y - camera.y - 18 * scale);
  ctx.save();
  if (facing === "left") {
    ctx.translate(drawX + 24 * scale, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(sprite, 0, drawY, 24 * scale, 32 * scale);
  } else {
    ctx.drawImage(sprite, drawX, drawY, 24 * scale, 32 * scale);
  }
  ctx.restore();
}

function drawHero(entity, cls, camera) {
  const image = cls?.portrait;
  if (!(image && image.complete && image.naturalWidth > 0)) {
    drawHuman(entity, cls.sprite, camera);
    return;
  }

  const facing = facingFromAngle(entity.angle);
  const moveBob = Math.sin((entity.anim || 0) * 3.2) * (entity.anim ? 2.5 : 0);
  const attackProgress = entity.actionAnim > 0 ? 1 - entity.actionAnim / 7 : 0;
  const attackSwing = entity.actionAnim > 0 ? Math.sin(attackProgress * Math.PI) : 0;
  const isMage = cls.name === "Mage";
  const isArcher = cls.name === "Archer";
  const baseScale = cls.renderScale || 0.16;
  const drawW = Math.floor(image.naturalWidth * baseScale);
  const drawH = Math.floor(image.naturalHeight * baseScale);
  const drawX = Math.floor(entity.x - camera.x - drawW / 2);
  const footOffset = cls.footOffset || 4;
  const drawY = Math.floor(entity.y - camera.y - drawH + 18 + footOffset + moveBob);
  const flip = facing !== "left";
  const tilt = flip ? -0.04 : 0.04;
  const attackTilt = isMage ? -attackSwing * 0.1 : isArcher ? attackSwing * 0.14 : attackSwing * 0.18;
  const squashX = 1 + (entity.anim ? Math.abs(moveBob) * 0.01 : 0);
  const squashY = 1 - (entity.anim ? Math.abs(moveBob) * 0.008 : 0);
  const handSide = flip ? -1 : 1;

  ctx.save();
  ctx.translate(drawX + drawW / 2, drawY + drawH / 2);
  ctx.scale(flip ? -squashX : squashX, squashY);
  ctx.rotate(tilt + attackTilt);
  ctx.drawImage(image, -drawW / 2, -drawH / 2, drawW, drawH);

  if (entity.actionAnim > 0) {
    ctx.globalAlpha = 0.78;
    if (cls.name === "Warrior") {
      ctx.fillStyle = palette.hitSpark;
      ctx.save();
      ctx.translate(drawW * 0.08 * handSide, drawH * 0.04);
      ctx.rotate(handSide * (0.85 - attackSwing * 0.55));
      ctx.fillRect(0, -2, 44, 4);
      ctx.fillStyle = "#d7d7d7";
      ctx.fillRect(6, -1, 28, 2);
      ctx.fillStyle = palette.hitSpark;
      ctx.fillRect(34, -4, 14, 8);
      ctx.restore();
      ctx.fillStyle = palette.slash;
      ctx.beginPath();
      ctx.arc(drawW * 0.16 * handSide, drawH * 0.06, 22 + attackSwing * 12, -0.7, 0.7);
      ctx.strokeStyle = palette.hitSpark;
      ctx.lineWidth = 3;
      ctx.stroke();
    } else if (cls.name === "Archer") {
      ctx.save();
      ctx.translate(drawW * 0.03 * handSide, drawH * 0.02);
      ctx.rotate(handSide * -0.15);
      ctx.strokeStyle = "#8b5a2b";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 18, -1.1, 1.1);
      ctx.stroke();
      ctx.strokeStyle = "#d8d0c2";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(2, -16);
      ctx.lineTo(-6 - attackSwing * 14, 16);
      ctx.stroke();
      ctx.fillStyle = palette.arrow;
      ctx.fillRect(-8 - attackSwing * 18, -1, 24, 2);
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(drawW * 0.16 * handSide, -8);
      ctx.rotate(handSide * 0.2);
      ctx.fillStyle = "#8b5a2b";
      ctx.fillRect(-2, -4, 4, 38);
      ctx.fillStyle = "#c8a24f";
      ctx.beginPath();
      ctx.arc(0, -8, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = palette.manaGlow;
      ctx.beginPath();
      ctx.arc(drawW * 0.18 * handSide, -10, 12 + attackSwing * 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = palette.mana;
      ctx.fillRect(drawW * 0.18 * handSide - 10, -12, 20, 4);
      ctx.fillRect(drawW * 0.18 * handSide - 2, -20, 4, 20);
    }
  }
  ctx.restore();
}

function drawSpritePreview(spriteSet, x, y, scale = 4) {
  const sprite = spriteSet.down[0];
  ctx.drawImage(sprite, x, y, 24 * scale, 32 * scale);
}

function drawPortrait(image, fallbackSpriteSet, x, y, w, h, scale = 4) {
  if (image && image.complete && image.naturalWidth > 0) {
    ctx.drawImage(image, x, y, w, h);
    return;
  }
  drawSpritePreview(fallbackSpriteSet, x + Math.floor((w - 24 * scale) / 2), y + Math.floor((h - 32 * scale) / 2), scale);
}

function drawRoad(route, camera) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = palette.grassDark;
  ctx.lineWidth = route.width + 18;
  ctx.beginPath();
  ctx.moveTo(route.points[0].x - camera.x, route.points[0].y - camera.y);
  for (let i = 1; i < route.points.length; i += 1) ctx.lineTo(route.points[i].x - camera.x, route.points[i].y - camera.y);
  ctx.stroke();
  ctx.strokeStyle = palette.roadEdge;
  ctx.lineWidth = route.width + 4;
  ctx.stroke();
  ctx.strokeStyle = palette.road;
  ctx.lineWidth = route.width;
  ctx.stroke();
  ctx.strokeStyle = palette.lane;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 16]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawBuilding(building, camera) {
  const x = Math.floor(building.x - camera.x);
  const y = Math.floor(building.y - camera.y);
  ctx.fillStyle = palette.shadow;
  ctx.fillRect(x + 8, y + 8, building.w, building.h);
  ctx.fillStyle = building.wall;
  ctx.fillRect(x, y, building.w, building.h);
  ctx.fillStyle = building.roof;
  ctx.fillRect(x + 8, y + 8, building.w - 16, building.h - 16);
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  for (let i = 0; i < building.w - 18; i += 24) ctx.fillRect(x + 9 + i, y + 18, 8, building.h - 36);
  ctx.fillStyle = palette.moss;
  ctx.fillRect(x + 10, y + 10, building.w - 20, 6);
  ctx.fillStyle = palette.stone;
  ctx.fillRect(x + 4, y + building.h - 10, building.w - 8, 6);
}

function drawTree(tree, camera) {
  const sway = Math.sin(worldTime * 1.8 + tree.sway) * 2;
  const x = tree.x - camera.x;
  const y = tree.y - camera.y;
  const topX = x + sway;

  if (tree.kind === "pine") {
    ctx.fillStyle = palette.trunk;
    ctx.fillRect(x - 3, y - 1, 6, 14);
    ctx.fillStyle = palette.tree;
    ctx.fillRect(topX - tree.r + 4, y - tree.r - 2, tree.r * 2 - 8, tree.r - 2);
    ctx.fillRect(topX - tree.r + 1, y - tree.r / 2, tree.r * 2 - 2, tree.r - 1);
    ctx.fillRect(topX - tree.r + 6, y + 4, tree.r * 2 - 12, tree.r - 4);
    return;
  }

  if (tree.kind === "birch") {
    ctx.fillStyle = "#d8d8cf";
    ctx.fillRect(x - 4, y - 2, 8, 18);
    ctx.fillStyle = "#4c4c4c";
    ctx.fillRect(x - 4, y + 2, 8, 2);
    ctx.fillRect(x - 3, y + 8, 6, 2);
    ctx.fillStyle = palette.tree;
    ctx.fillRect(topX - tree.r, y - tree.r, tree.r * 2, tree.r * 2 - 2);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(topX - tree.r + 2, y - tree.r + 2, tree.r, tree.r - 2);
    return;
  }

  if (tree.kind === "dead") {
    ctx.fillStyle = palette.trunk;
    ctx.fillRect(x - 4, y - 2, 8, 20);
    ctx.fillRect(x - 13, y + 3, 12, 3);
    ctx.fillRect(x + 1, y + 6, 12, 3);
    ctx.fillRect(x - 2, y - 10, 3, 12);
    return;
  }

  ctx.fillStyle = palette.trunk;
  ctx.fillRect(x - 4, y - 2, 8, 14);
  ctx.fillStyle = palette.tree;
  ctx.fillRect(topX - tree.r, y - tree.r, tree.r * 2, tree.r * 2);
  ctx.fillStyle = palette.brush;
  ctx.fillRect(topX - tree.r + 4, y - tree.r + 6, tree.r * 2 - 8, tree.r * 2 - 12);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(topX - tree.r + 3, y - tree.r + 3, tree.r, tree.r - 2);
}

function drawWorld(camera) {
  if (worldEvent.active === "cursedFog") {
    ctx.fillStyle = "#547f42";
  } else {
    ctx.fillStyle = palette.grass;
  }
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = palette.grassLight;
  for (let i = 0; i < 80; i += 1) {
    const sx = ((i * 131) % WORLD.width) - camera.x;
    const sy = ((i * 97) % WORLD.height) - camera.y;
    ctx.fillRect(sx, sy, 22, 10);
  }

  ctx.fillStyle = palette.grassDark;
  for (let i = 0; i < 120; i += 1) {
    const gx = (i * 77) % WORLD.width - camera.x;
    const gy = (i * 51) % WORLD.height - camera.y;
    ctx.fillRect(gx, gy, 34, 16);
  }

  for (const zone of waterZones) {
    ctx.fillStyle = palette.water;
    ctx.fillRect(zone.x - camera.x, zone.y - camera.y, zone.w, zone.h);
    ctx.strokeStyle = palette.waterDark;
    ctx.strokeRect(zone.x - camera.x, zone.y - camera.y, zone.w, zone.h);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    for (let i = 0; i < zone.w; i += 34) {
      const rippleY = zone.y - camera.y + 8 + ((i / 34) % 4) * 10 + Math.sin(worldTime * 2.6 + i * 0.08) * 3;
      ctx.fillRect(zone.x - camera.x + i, rippleY, 18, 2);
    }
    ctx.fillStyle = palette.waterLight;
    ctx.fillRect(zone.x - camera.x + 8, zone.y - camera.y + 8, Math.max(14, zone.w * 0.18), 3);
  }

  ctx.fillStyle = palette.brush;
  for (let i = 0; i < 140; i += 1) {
    const bx = (i * 91) % WORLD.width - camera.x;
    const by = (i * 63) % WORLD.height - camera.y;
    ctx.fillRect(bx, by, 7, 10 + (i % 3) * 3);
  }

  for (const firefly of fireflies) {
    const fx = firefly.x - camera.x + Math.sin(worldTime * 0.6 + firefly.pulse) * 12;
    const fy = firefly.y - camera.y + Math.cos(worldTime * 0.8 + firefly.pulse) * 6;
    ctx.fillStyle = `rgba(255,240,160,${0.25 + (Math.sin(worldTime * 3 + firefly.pulse) + 1) * 0.2})`;
    ctx.fillRect(fx, fy, 3, 3);
  }

  for (const leaf of ambientLeaves) {
    const lx = leaf.x - camera.x + Math.sin(worldTime + leaf.sway) * 12;
    const ly = leaf.y - camera.y + ((worldTime * 24 * leaf.drift) % 80);
    ctx.fillStyle = leaf.sway % 2 > 1 ? palette.moss : palette.roadEdge;
    ctx.fillRect(lx, ly, 4, 2);
  }

  for (const route of routes) drawRoad(route, camera);
  for (const tree of trees) drawTree(tree, camera);
  for (const building of buildings) drawBuilding(building, camera);
}

function drawEventOverlay(camera) {
  if (!worldEvent.active) return;
  ctx.save();
  if (worldEvent.active === "cursedFog") {
    ctx.fillStyle = "rgba(80, 110, 70, 0.18)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (worldEvent.active === "healingGrove") {
    const target = currentTarget();
    ctx.globalAlpha = 0.24;
    ctx.fillStyle = palette.ultimateLeaf;
    ctx.beginPath();
    ctx.arc(target.x - camera.x, target.y - camera.y, 92, 0, Math.PI * 2);
    ctx.fill();
  } else if (worldEvent.active === "meteorRain") {
    ctx.fillStyle = "rgba(255, 164, 76, 0.08)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (worldEvent.active === "eliteHunt") {
    ctx.fillStyle = "rgba(180, 70, 120, 0.08)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.restore();
}

function drawLabels(camera) {
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.font = "bold 16px monospace";
  for (const area of Object.values(areas)) ctx.fillText(area.name, area.x - camera.x + 10, area.y - camera.y - 10);
  ctx.fillText(upgradeStation.name, upgradeStation.x - camera.x + 10, upgradeStation.y - camera.y - 10);
}

function drawMarker(camera) {
  const target = currentTarget();
  ctx.fillStyle = "#ffef75";
  ctx.fillRect(target.x - camera.x - 10, target.y - camera.y - 10, 20, 20);
  ctx.strokeStyle = "#603a0a";
  ctx.strokeRect(target.x - camera.x - 10, target.y - camera.y - 10, 20, 20);

  ctx.fillStyle = "#7ad8ff";
  ctx.fillRect(upgradeStation.x - camera.x - 8, upgradeStation.y - camera.y - 8, 16, 16);
  ctx.strokeStyle = "#153d54";
  ctx.strokeRect(upgradeStation.x - camera.x - 8, upgradeStation.y - camera.y - 8, 16, 16);
}

function drawProjectiles(camera) {
  for (const projectile of projectiles) {
    ctx.fillStyle = projectile.kind === "arrow" ? palette.arrow : projectile.kind === "fire" ? palette.fire : projectile.kind === "acid" ? palette.acid : palette.mana;
    ctx.save();
    ctx.translate(Math.floor(projectile.x - camera.x), Math.floor(projectile.y - camera.y));
    ctx.rotate(projectile.angle);
    if (projectile.kind === "arrow") {
      ctx.fillRect(-projectile.size, -1, projectile.size * 2 + 3, 2);
    } else if (projectile.kind === "fire") {
      ctx.fillRect(-projectile.size / 2, -projectile.size / 3, projectile.size, (projectile.size * 2) / 3);
      ctx.fillStyle = "#ffd27a";
      ctx.fillRect(0, -projectile.size / 4, projectile.size / 2, projectile.size / 2);
    } else if (projectile.kind === "acid") {
      ctx.beginPath();
      ctx.arc(0, 0, projectile.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#d9ff9c";
      ctx.fillRect(-projectile.size / 2, -2, projectile.size, 4);
    } else {
      ctx.fillRect(-projectile.size / 2, -projectile.size / 2, projectile.size, projectile.size);
    }
    ctx.restore();
  }
}

function drawTraps(camera) {
  for (const trap of traps) {
    ctx.save();
    ctx.globalAlpha = clamp(trap.life / 420, 0.25, 0.8);
    ctx.strokeStyle = palette.arrow;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(trap.x - camera.x, trap.y - camera.y, trap.radius * 0.35, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = palette.hitSpark;
    ctx.fillRect(trap.x - camera.x - 4, trap.y - camera.y - 4, 8, 8);
    ctx.restore();
  }
}

function drawArrowTrails(camera) {
  for (const trail of arrowTrails) {
    const alpha = clamp(trail.life / 8, 0.1, 0.45);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = palette.arrowTrail;
    ctx.translate(Math.floor(trail.x - camera.x), Math.floor(trail.y - camera.y));
    ctx.rotate(trail.angle);
    ctx.fillRect(-trail.size - 6, -1, trail.size * 2 + 6, 2);
    ctx.restore();
  }
}

function drawHitEffects(camera) {
  for (const effect of hitEffects) {
    const alpha = clamp(effect.life / 8, 0.18, 0.75);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = effect.kind === "arrowHit" ? palette.hitEmber : palette.hitSpark;
    ctx.fillRect(effect.x - camera.x - effect.radius / 2, effect.y - camera.y - 2, effect.radius, 4);
    ctx.fillRect(effect.x - camera.x - 2, effect.y - camera.y - effect.radius / 2, 4, effect.radius);
    ctx.restore();
  }
}

function drawSpellExplosions(camera) {
  for (const burst of spellExplosions) {
    const alpha = clamp(burst.life / 12, 0.12, 0.55);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = burst.kind === "fire" ? palette.fireGlow : burst.kind === "acid" ? palette.acidGlow : palette.manaGlow;
    ctx.beginPath();
    ctx.arc(burst.x - camera.x, burst.y - camera.y, burst.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = burst.kind === "fire" ? palette.fire : burst.kind === "acid" ? palette.acid : palette.mana;
    ctx.fillRect(burst.x - camera.x - burst.radius / 3, burst.y - camera.y - 2, burst.radius * 0.66, 4);
    ctx.fillRect(burst.x - camera.x - 2, burst.y - camera.y - burst.radius / 3, 4, burst.radius * 0.66);
    ctx.restore();
  }
}

function drawAcidPools(camera) {
  for (const pool of acidPools) {
    const alpha = clamp(pool.life / 150, 0.18, 0.55);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = palette.acidGlow;
    ctx.beginPath();
    ctx.arc(pool.x - camera.x, pool.y - camera.y, pool.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = palette.acid;
    ctx.beginPath();
    ctx.arc(pool.x - camera.x, pool.y - camera.y, pool.radius * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawMegaBossRoar(camera) {
  if (!(megaBoss && megaBoss.roarTimer > 0)) return;
  const alpha = clamp(megaBoss.roarTimer / 90, 0.15, 0.45);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = palette.acidGlow;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(megaBoss.x - camera.x + 20, megaBoss.y - camera.y - 18, 28 + (90 - megaBoss.roarTimer) * 0.6, -0.6, 0.6);
  ctx.stroke();
  ctx.restore();
}

function drawDragon(camera) {
  if (player.dragonTimer <= 0) return;

  const x = Math.floor(player.x - camera.x);
  const y = Math.floor(player.y - camera.y);
  const facingLeft = facingFromAngle(player.angle) === "left";
  ctx.save();
  ctx.translate(x, y + 2);
  if (facingLeft) ctx.scale(-1, 1);

  ctx.fillStyle = "#7a2f1f";
  ctx.fillRect(-34, -20, 54, 26);
  ctx.fillRect(18, -16, 16, 14);
  ctx.fillRect(-20, 4, 10, 14);
  ctx.fillRect(2, 4, 10, 14);
  ctx.fillRect(-40, -8, 12, 8);
  ctx.fillStyle = "#b6462c";
  ctx.fillRect(-24, -32, 20, 16);
  ctx.fillRect(-4, -30, 24, 18);
  ctx.fillRect(-46, -4, 10, 6);
  ctx.fillStyle = "#d86a35";
  ctx.fillRect(22, -12, 8, 4);
  ctx.fillRect(28, -10, 8, 2);
  ctx.fillStyle = "#f5d07a";
  ctx.fillRect(26, -10, 10 + Math.sin(worldTime * 10) * 4, 3);
  ctx.restore();
}

function drawGoreEffects(camera) {
  for (const gore of goreEffects) {
    const alpha = clamp(gore.life / 26, 0.12, 0.55);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = gore.boss ? palette.goreDark : palette.gore;
    ctx.fillRect(gore.x - camera.x - gore.radius / 2, gore.y - camera.y - 3, gore.radius, 6);
    ctx.fillRect(gore.x - camera.x - 3, gore.y - camera.y - gore.radius / 2, 6, gore.radius);
    ctx.fillRect(gore.x - camera.x - gore.radius / 3, gore.y - camera.y - gore.radius / 3, gore.radius * 0.66, gore.radius * 0.66);
    ctx.restore();
  }
}

function drawUltimateEffects(camera) {
  for (const effect of ultimateEffects) {
    const alpha = clamp(effect.life / 24, 0.12, 0.45);
    ctx.save();
    ctx.globalAlpha = alpha;
    if (effect.kind === "warrior") {
      ctx.fillStyle = palette.ultimateGold;
      ctx.beginPath();
      ctx.arc(effect.x - camera.x, effect.y - camera.y, effect.radius * 0.55, effect.angle - 1.1, effect.angle + 1.1);
      ctx.lineTo(effect.x - camera.x, effect.y - camera.y);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(effect.x - camera.x - effect.radius * 0.45, effect.y - camera.y - 4, effect.radius * 0.9, 8);
    } else if (effect.kind === "archer") {
      ctx.fillStyle = palette.ultimateLeaf;
      for (let i = -3; i <= 3; i += 1) {
        const angle = effect.angle + i * 0.12;
        ctx.save();
        ctx.translate(effect.x - camera.x, effect.y - camera.y);
        ctx.rotate(angle);
        ctx.fillRect(-6, -2, effect.radius, 4);
        ctx.restore();
      }
    } else {
      ctx.fillStyle = palette.ultimateArcane;
      ctx.beginPath();
      ctx.arc(effect.x - camera.x, effect.y - camera.y, effect.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = palette.manaGlow;
      ctx.beginPath();
      ctx.arc(effect.x - camera.x, effect.y - camera.y, effect.radius * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawSlashes(camera) {
  for (const slash of slashes) {
    const alpha = clamp(slash.life / 16, 0.15, 0.6);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = palette.slash;
    ctx.beginPath();
    ctx.arc(slash.x - camera.x, slash.y - camera.y, slash.radius * 0.45, slash.angle - 0.7, slash.angle + 0.7);
    ctx.lineTo(slash.x - camera.x, slash.y - camera.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawHearts(camera) {
  for (const heart of hearts) {
    if (!heart.active) continue;
    const x = heart.x - camera.x;
    const y = heart.y - camera.y;
    ctx.fillStyle = palette.heart;
    ctx.fillRect(x - 6, y - 4, 12, 8);
    ctx.fillRect(x - 4, y - 8, 8, 16);
    ctx.fillStyle = palette.heartDark;
    ctx.fillRect(x - 6, y - 8, 4, 4);
    ctx.fillRect(x + 2, y - 8, 4, 4);
  }
}

function drawDamageNumbers(camera) {
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  for (const number of damageNumbers) {
    ctx.save();
    ctx.globalAlpha = clamp(number.life / 36, 0.15, 1);
    ctx.fillStyle = number.color;
    ctx.font = `bold ${number.size}px monospace`;
    ctx.fillText(String(number.value), number.x - camera.x, number.y - camera.y - number.drift);
    ctx.restore();
  }
  ctx.textAlign = "left";
}

function drawBossBars() {
  let y = 16;
  const activeBosses = zombies.filter((zombie) => zombie.boss && zombie.active && zombie.downFor <= 0);
  for (const boss of activeBosses) {
    ctx.fillStyle = palette.bossBarBg;
    ctx.fillRect(canvas.width / 2 - 130, y, 260, 16);
    ctx.fillStyle = palette.bossBar;
    ctx.fillRect(canvas.width / 2 - 128, y + 2, 256 * (boss.health / boss.maxHealth), 12);
    ctx.strokeStyle = palette.hudGold;
    ctx.strokeRect(canvas.width / 2 - 130, y, 260, 16);
    ctx.fillStyle = palette.text;
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    const label = boss.bossType === "grove" ? "Grove Horror" : boss.bossType === "marsh" ? "Marsh Tyrant" : boss.bossType === "ruin" ? "Ruin Brute" : "Boss Zombie";
    ctx.fillText(label, canvas.width / 2, y + 12);
    y += 22;
  }
  if (megaBoss) {
    ctx.fillStyle = palette.bossBarBg;
    ctx.fillRect(canvas.width / 2 - 180, y, 360, 20);
    ctx.fillStyle = "#9bdc5b";
    ctx.fillRect(canvas.width / 2 - 178, y + 2, 356 * (megaBoss.health / megaBoss.maxHealth), 16);
    ctx.strokeStyle = palette.hudGold;
    ctx.strokeRect(canvas.width / 2 - 180, y, 360, 20);
    ctx.fillStyle = palette.text;
    ctx.font = "bold 13px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Mega Boss", canvas.width / 2, y + 14);
  }
  ctx.textAlign = "left";
}

function drawHUD() {
  ctx.fillStyle = palette.hud;
  ctx.fillRect(14, 14, 356, 126);
  ctx.strokeStyle = palette.hudGold;
  ctx.strokeRect(14, 14, 356, 126);
  ctx.fillStyle = palette.text;
  ctx.font = "16px monospace";
  ctx.fillText(`Gold   ${player.money}`, 28, 38);
  ctx.fillText(`Class  ${currentClass().name}`, 28, 60);
  ctx.fillText(`Weapon ${currentUpgrade().name}`, 28, 82);
  ctx.fillText(`Branch ${branchName()}`, 28, 104);
  ctx.fillText(`Health ${Math.round(player.health)}/${player.maxHealth}`, 28, 126);

  ctx.fillStyle = player.invuln > 0 ? "#84ddff" : "#ff6f6f";
  ctx.fillRect(210, 110, 140 * (player.health / player.maxHealth), 12);
  ctx.strokeStyle = palette.hudLine;
  ctx.strokeRect(210, 110, 140, 12);

  ctx.fillStyle = palette.hud;
  ctx.fillRect(14, canvas.height - 70, 560, 56);
  ctx.strokeStyle = palette.hudLine;
  ctx.strokeRect(14, canvas.height - 70, 560, 56);
  ctx.fillStyle = palette.text;
  ctx.fillText(`Horde ${survival.hordeLevel} | Bosses ${survival.bossesAwake} | ${currentTarget().name}`, 28, canvas.height - 42);
  ctx.fillText(`Esc pause | Z branch | E class skill | 1-4 passives at forge`, 28, canvas.height - 22);
}

function drawMinimap(camera) {
  const mapW = 190;
  const mapH = 140;
  const pad = 14;
  const scaleX = mapW / WORLD.width;
  const scaleY = mapH / WORLD.height;
  const x = canvas.width - mapW - pad;
  const y = pad;

  ctx.fillStyle = palette.hud;
  ctx.fillRect(x, y, mapW, mapH);
  ctx.strokeStyle = palette.hudLine;
  ctx.strokeRect(x, y, mapW, mapH);
  ctx.fillStyle = palette.grass;
  ctx.fillRect(x + 1, y + 1, mapW - 2, mapH - 2);

  ctx.fillStyle = palette.water;
  for (const zone of waterZones) ctx.fillRect(x + zone.x * scaleX, y + zone.y * scaleY, zone.w * scaleX, zone.h * scaleY);
  ctx.strokeStyle = palette.roadEdge;
  for (const route of routes) {
    ctx.lineWidth = Math.max(2, route.width * scaleX);
    ctx.beginPath();
    ctx.moveTo(x + route.points[0].x * scaleX, y + route.points[0].y * scaleY);
    for (let i = 1; i < route.points.length; i += 1) ctx.lineTo(x + route.points[i].x * scaleX, y + route.points[i].y * scaleY);
    ctx.stroke();
  }

  ctx.fillStyle = "#ffef75";
  ctx.fillRect(x + currentTarget().x * scaleX - 2, y + currentTarget().y * scaleY - 2, 5, 5);
  ctx.fillStyle = "#7cff89";
  ctx.fillRect(x + player.x * scaleX - 2, y + player.y * scaleY - 2, 5, 5);
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.strokeRect(x + camera.x * scaleX, y + camera.y * scaleY, canvas.width * scaleX, canvas.height * scaleY);
}

function drawButton(x, y, w, h, label, onClick, active = false) {
  const hovered = mousePos.x >= x && mousePos.x <= x + w && mousePos.y >= y && mousePos.y <= y + h;
  if (hovered) hoveredButton = label;
  ctx.save();
  ctx.fillStyle = hovered ? "#31596f" : active ? "#28425f" : "#121a24";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = hovered ? palette.hudGold : active ? "#ffcf56" : "#273347";
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = palette.text;
  ctx.font = "bold 20px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  ctx.restore();
  uiButtons.push({ x, y, w, h, onClick });
}

function drawWrappedText(text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let lineY = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, lineY);
      line = word;
      lineY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, lineY);
}

function drawWrappedTextCentered(text, centerX, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let lineY = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, centerX, lineY);
      line = word;
      lineY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, centerX, lineY);
}

function drawMenuScreen() {
  const panelW = 420;
  const panelX = Math.floor((canvas.width - panelW) / 2);
  const panelY = 54;
  const portraitY = 196;
  const portraitW = 110;
  const portraitGap = 26;
  const titleX = panelX + panelW / 2;

  ctx.fillStyle = "#0f1610";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = palette.grass;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(0,0,0,0.34)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = palette.hud;
  ctx.fillRect(panelX, panelY, panelW, canvas.height - 108);
  ctx.strokeStyle = palette.hudLine;
  ctx.strokeRect(panelX, panelY, panelW, canvas.height - 108);

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = palette.text;
  ctx.font = "bold 36px monospace";
  ctx.fillText("Whisperwood", titleX, 96);
  ctx.fillText("Outbreak", titleX, 132);
  ctx.font = "16px monospace";
  drawWrappedTextCentered("Medieval survival against the undead.", titleX, 162, panelW - 68, 20);

  drawPortrait(classPortraits.warrior, sprites.warrior, panelX + 26, portraitY, portraitW, 150, 3);
  drawPortrait(classPortraits.archer, sprites.archer, panelX + 26 + portraitW + portraitGap, portraitY, portraitW, 150, 3);
  drawPortrait(classPortraits.mage, sprites.mage, panelX + 26 + (portraitW + portraitGap) * 2, portraitY, portraitW, 150, 3);

  drawButton(panelX + 26, 360, panelW - 52, 52, "Play", () => { gameState = "classSelect"; menuNotice = ""; }, true);
  drawButton(panelX + 26, 426, panelW - 52, 52, "Settings", () => { gameState = "settings"; menuNotice = ""; });
  drawButton(panelX + 26, 492, panelW - 52, 52, "Exit", () => { menuNotice = "Close this tab to exit."; });

  if (menuNotice) {
    ctx.fillStyle = palette.text;
    ctx.font = "16px monospace";
    ctx.textAlign = "left";
    drawWrappedText(menuNotice, panelX + 26, 582, panelW - 52, 22);
  }
}

function drawClassSelectScreen() {
  const cardW = 250;
  const cardH = 370;
  const cardGap = 35;
  const totalW = cardW * 3 + cardGap * 2;
  const startX = Math.floor((canvas.width - totalW) / 2);
  const cardY = 128;

  ctx.fillStyle = "#101711";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = palette.text;
  ctx.font = "bold 36px monospace";
  ctx.fillText("Choose Your Class", startX, 82);
  ctx.font = "16px monospace";
  ctx.fillText("Each class upgrades into stronger attacks and an ultimate move.", startX + 2, 110);

  const cards = ["warrior", "archer", "mage"];
  cards.forEach((key, index) => {
    const cls = classDefinitions[key];
    const x = startX + index * (cardW + cardGap);
    const y = cardY;
    ctx.fillStyle = "#121a24";
    ctx.fillRect(x, y, cardW, cardH);
    ctx.strokeStyle = cls.color;
    ctx.strokeRect(x, y, cardW, cardH);
    drawPortrait(cls.portrait, cls.sprite, x + 24, y + 20, cardW - 48, 142, 4);
    ctx.fillStyle = palette.text;
    ctx.font = "bold 24px monospace";
    ctx.fillText(cls.name, x + 22, y + 180);
    ctx.font = "14px monospace";
    ctx.fillText(cls.weaponName, x + 22, y + 208);
    ctx.fillText(cls.upgrades[3].ultimateName, x + 22, y + 230);
    ctx.fillText(`DMG ${cls.role.damage} SPD ${cls.role.speed}`, x + 22, y + 248);
    ctx.fillText(`RNG ${cls.role.range} DIF ${cls.role.difficulty}`, x + 22, y + 266);
    drawWrappedText(cls.description, x + 22, y + 288, cardW - 44, 16);
    drawButton(x + 22, y + cardH - 54, cardW - 44, 38, `Play ${cls.name}`, () => startNewRun(key), false);
  });

  drawButton(startX, 520, 140, 42, "Back", () => { gameState = "menu"; });
}

function drawSettingsScreen() {
  const panelW = 560;
  const panelH = 340;
  const panelX = Math.floor((canvas.width - panelW) / 2);
  const panelY = 96;

  ctx.fillStyle = "#101711";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = palette.hud;
  ctx.fillRect(panelX, panelY, panelW, panelH);
  ctx.strokeStyle = palette.hudLine;
  ctx.strokeRect(panelX, panelY, panelW, panelH);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = palette.text;
  ctx.font = "bold 34px monospace";
  ctx.fillText("Settings", panelX + 28, panelY + 52);
  ctx.font = "18px monospace";
  ctx.fillText(`Difficulty: ${settingsState.difficulty}`, panelX + 28, panelY + 130);
  ctx.fillText(`Sound: ${settingsState.soundOn ? "on" : "off"}`, panelX + 28, panelY + 210);

  drawButton(panelX + panelW - 220, panelY + 92, 180, 46, "Cycle Difficulty", () => {
    const order = ["easy", "normal", "hard"];
    const next = (order.indexOf(settingsState.difficulty) + 1) % order.length;
    settingsState.difficulty = order[next];
  });
  drawButton(panelX + panelW - 220, panelY + 172, 180, 46, settingsState.soundOn ? "Sound On" : "Sound Off", () => {
    settingsState.soundOn = !settingsState.soundOn;
  }, settingsState.soundOn);
  drawButton(panelX + 28, panelY + panelH - 70, 140, 42, "Back", () => { gameState = "menu"; });
}

function drawPauseOverlay() {
  ctx.fillStyle = "rgba(4,8,10,0.56)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = palette.hud;
  ctx.fillRect(canvas.width / 2 - 160, canvas.height / 2 - 70, 320, 140);
  ctx.strokeStyle = palette.hudGold;
  ctx.strokeRect(canvas.width / 2 - 160, canvas.height / 2 - 70, 320, 140);
  ctx.fillStyle = palette.text;
  ctx.font = "bold 28px monospace";
  ctx.textAlign = "center";
  ctx.fillText("Paused", canvas.width / 2, canvas.height / 2 - 12);
  ctx.font = "16px monospace";
  ctx.fillText("Press Esc to resume", canvas.width / 2, canvas.height / 2 + 26);
  ctx.textAlign = "left";
}

function renderGameplay() {
  const shakeX = screenShake > 0 ? Math.round((Math.random() - 0.5) * screenShake) : 0;
  const shakeY = screenShake > 0 ? Math.round((Math.random() - 0.5) * screenShake) : 0;
  const camera = {
    x: clamp(player.x - canvas.width / 2 + shakeX, 0, WORLD.width - canvas.width),
    y: clamp(player.y - canvas.height / 2 + shakeY, 0, WORLD.height - canvas.height),
  };

  drawWorld(camera);
  drawEventOverlay(camera);
  drawMarker(camera);
  drawLabels(camera);
  drawHearts(camera);
  drawAcidPools(camera);
  drawDragon(camera);
  drawTraps(camera);
  drawArrowTrails(camera);
  drawUltimateEffects(camera);
  drawSpellExplosions(camera);
  drawProjectiles(camera);
  drawSlashes(camera);
  drawGoreEffects(camera);
  drawHitEffects(camera);
  for (const zombie of zombies) {
    if (zombie.downFor <= 0 && zombie.active) drawHuman(zombie, zombie.sprite, camera, zombie.boss ? 1.2 : 1);
  }
  if (megaBoss) drawHuman(megaBoss, megaBoss.sprite, camera, 2.2);
  drawMegaBossRoar(camera);
  drawHuman(player, currentClass().sprite, camera, 1);
  drawMinimap(camera);
  drawHUD();
  drawBossBars();
  drawDamageNumbers(camera);
  if (hoveredButton && gameState !== "playing") {
    ctx.fillStyle = palette.hud;
    ctx.fillRect(canvas.width - 210, canvas.height - 42, 190, 24);
    ctx.strokeStyle = palette.hudLine;
    ctx.strokeRect(canvas.width - 210, canvas.height - 42, 190, 24);
    ctx.fillStyle = palette.text;
    ctx.font = "12px monospace";
    ctx.fillText(`Selected: ${hoveredButton}`, canvas.width - 198, canvas.height - 26);
  }
  if (isPaused) drawPauseOverlay();
  if (screenShake > 6) {
    ctx.fillStyle = palette.flash;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function render() {
  uiButtons = [];
  hoveredButton = null;
  if (gameState === "menu") {
    drawMenuScreen();
    return;
  }
  if (gameState === "classSelect") {
    drawClassSelectScreen();
    return;
  }
  if (gameState === "settings") {
    drawSettingsScreen();
    return;
  }
  renderGameplay();
}
