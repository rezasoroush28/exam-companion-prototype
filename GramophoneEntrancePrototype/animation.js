/* Isolated, absolute-time SVG rig. No game imports, network, audio, or packages.
 * Artwork: user-supplied gramophone-svg-assets.zip / assets-redesigned.
 * Split rods keep rigid lengths; analytical two-link IK plants the feet and
 * makes the same wrist coordinate drive both the hand and the vinyl disc.
 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const ease = t => { t = clamp(t); return t * t * (3 - 2 * t); };
  const rad = 180 / Math.PI;
  const stages = [
    ['walk-in', 1800], ['stop-and-settle', 250], ['sit', 500],
    ['notice-pocket', 250], ['reach-pocket', 450], ['open-pocket', 250],
    ['grab-disc', 350], ['pull-disc-out', 550], ['hold-disc', 500]
  ];
  const total = stages.reduce((sum, stage) => sum + stage[1], 0);
  let frame = 0, runId = 0;
  const transform = (id, value) => $(id).setAttribute('transform', value);
  const rotate = (id, angle, x, y) => transform(id, `rotate(${angle} ${x} ${y})`);

  // Returns a rigid two-link chain, clamped only to its physically reachable radius.
  function solve(hip, target, first, second, bend) {
    let dx = target.x - hip.x, dy = target.y - hip.y;
    const distance = Math.hypot(dx, dy);
    const reachable = clamp(distance, Math.abs(first - second) + .01, first + second - .01);
    dx *= reachable / (distance || 1); dy *= reachable / (distance || 1);
    const elbow = bend * Math.acos(clamp((reachable ** 2 - first ** 2 - second ** 2) / (2 * first * second), -1, 1));
    const shoulder = Math.atan2(dy, dx) - Math.atan2(second * Math.sin(elbow), first + second * Math.cos(elbow));
    return { shoulder, elbow,
      knee: { x: hip.x + first * Math.cos(shoulder), y: hip.y + first * Math.sin(shoulder) },
      end: { x: hip.x + dx, y: hip.y + dy } };
  }

  function leg(side, pose) {
    const left = side === 'left';
    const hip = left ? {x:446,y:894} : {x:626,y:923};
    const knee = left ? {x:464,y:975} : {x:673,y:997};
    const origin = left ? {x:449,y:1038} : {x:661,y:1051};
    const first = Math.hypot(knee.x-hip.x,knee.y-hip.y);
    const second = Math.hypot(origin.x-knee.x,origin.y-knee.y);
    const foot = pose[side];
    const target = {x:origin.x+foot.x-pose.sway,y:origin.y-pose.y-foot.lift};
    const chain = solve(hip,target,first,second,left ? 1 : -1);
    const upperBase = Math.atan2(knee.y-hip.y,knee.x-hip.x);
    const lowerBase = Math.atan2(origin.y-knee.y,origin.x-knee.x);
    rotate(side+'-thigh',(chain.shoulder-upperBase)*rad,hip.x,hip.y);
    transform(side+'-shin',`translate(${chain.knee.x-knee.x} ${chain.knee.y-knee.y}) rotate(${(chain.shoulder+chain.elbow-lowerBase)*rad} ${knee.x} ${knee.y})`);
    transform(side+'-foot',`translate(${chain.end.x-origin.x} ${chain.end.y-origin.y}) rotate(${foot.tilt} ${origin.x} ${origin.y})`);
  }

  function arm(wrist) {
    const first=Math.hypot(93,32),second=Math.hypot(-33,-198);
    const baseShoulder=Math.atan2(32,93);
    const baseElbow=Math.atan2(-198,-33)-baseShoulder;
    const chain=solve({x:732,y:782},wrist,first,second,-1);
    rotate('right-arm',(chain.shoulder-baseShoulder)*rad,732,782);
    rotate('right-forearm',(chain.elbow-baseElbow)*rad,825,814);
    return chain.end;
  }

  function neutral() {
    return { x: 0, y: 45, sway: 0, horn: 0, leftArm: 0,
      left: { x: 0, lift: 0, tilt: 0 }, right: { x: 0, lift: 0, tilt: 0 },
      wrist: { x: 792, y: 616 }, flap: 0, disc: 0, grip: false, discAngle: -90 };
  }

  function gait(phase) {
    phase = ((phase % 1) + 1) % 1;
    if (phase < .5) return { x: 62.5 - 250 * phase, lift: 0, tilt: 0 };
    const swing = (phase - .5) * 2;
    return { x: mix(-62.5, 62.5, ease(swing)), lift: 40 * Math.sin(swing * Math.PI), tilt: -10 * Math.sin(swing * Math.PI) };
  }

  function walk(t) {
    const pose = neutral(), phase = 4 * t + .25;
    pose.x = mix(-1000, 0, t);
    pose.y = 45 - 9 * Math.sin(phase * Math.PI * 2) ** 2;
    pose.sway = 3 * Math.sin(phase * Math.PI * 2);
    pose.left = gait(phase); pose.right = gait(phase + .5);
    pose.horn = 3 * Math.sin(phase * Math.PI * 2 - .65);
    pose.leftArm = 7 * Math.sin(phase * Math.PI * 2 - .2);
    pose.wrist = { x: 792 + 12 * Math.sin(phase * Math.PI * 2), y: 640 + 18 * Math.sin(phase * Math.PI * 2) };
    return pose;
  }

  function seated() {
    const pose = neutral(); pose.y = 95;
    pose.left.x = -48; pose.right.x = 48; pose.leftArm = -7; pose.horn = 2;
    return pose;
  }

  function sample(index, t) {
    const q = ease(t);
    if (index === 0) return walk(t);
    if (index === 1) {
      const p = walk(1), n = neutral();
      p.y = mix(p.y, n.y, q) + 9 * Math.sin(Math.PI * t);
      p.sway *= 1 - q; p.horn = p.horn * (1 - q) - 2 * Math.sin(Math.PI * t);
      p.leftArm *= 1 - q;
      p.right.lift *= 1 - q; p.right.tilt *= 1 - q;
      p.wrist.x = mix(p.wrist.x, n.wrist.x, q); p.wrist.y = mix(p.wrist.y, n.wrist.y, q);
      return p;
    }
    if (index === 2) {
      const p = neutral(); p.y = mix(45, 95, q);
      p.left.x = -48 * q; p.right.x = 48 * q;
      p.left.lift = 16 * Math.sin(Math.PI * t); p.right.lift = 12 * Math.sin(Math.PI * t);
      p.horn = 2 * q + 3 * Math.sin(Math.PI * ease(clamp((t - .12) / .88)));
      p.leftArm = -7 * q; return p;
    }
    const p = seated();
    if (index === 3) { p.sway = 7 * q; p.horn = mix(2, 7, q); return p; }
    p.sway = 7; p.horn = 7;
    if (index === 4) {
      p.wrist = { x: mix(792, 746, q) + 140 * Math.sin(Math.PI * q), y: mix(616, 933, q) };
      p.leftArm = mix(-7, -12, q); return p;
    }
    p.wrist = { x: 746, y: 933 }; p.leftArm = -12;
    if (index === 5) { p.flap = q; p.disc = q; return p; }
    p.flap = 1; p.disc = 1; p.grip = true;
    if (index === 6) {
      // Grip tightens without moving the vinyl or breaking hand contact.
      p.horn = 7 + Math.sin(Math.PI * t); return p;
    }
    if (index === 7) {
      p.wrist = { x: mix(746, 925, q), y: mix(933, 710, q) };
      p.discAngle = mix(-90, 0, ease(clamp((t - .35) / .65)));
      p.sway = 7 * (1 - q); p.horn = mix(7, -3, q);
      p.flap = 1 - ease(clamp((t - .7) / .3));
      p.leftArm = mix(-12, -7, q); return p;
    }
    p.wrist = { x: 925, y: 710 }; p.sway = 0; p.flap = 0; p.discAngle = 0;
    p.leftArm = -7; p.horn = -3 + Math.sin(t * Math.PI) * .7;
    return p;
  }

  function render(pose) {
    transform('locomotion-root', `translate(${pose.x} 0)`);
    transform('body-root', `translate(${pose.sway} ${pose.y})`);
    rotate('horn-root', pose.horn, 451, 625);
    rotate('left-arm', pose.leftArm, 388, 711);
    leg('left', pose); leg('right', pose);
    const wrist = arm(pose.wrist);
    // Rotating a separate rigid flap avoids stretching the compartment.
    rotate('pocket-flap', -155 * pose.flap, 750, 795);
    const disc = $('disc-prop');
    disc.setAttribute('visibility', pose.disc > 0 ? 'visible' : 'hidden');
    disc.setAttribute('opacity', pose.disc);
    const angle = pose.discAngle / rad;
    const center = pose.grip ? { x: wrist.x + 67 * Math.cos(angle), y: wrist.y + 67 * Math.sin(angle) } : { x: 746, y: 866 };
    transform('disc-prop', `translate(${center.x} ${center.y}) rotate(${pose.discAngle - 90}) scale(1)`);
    disc.dataset.gripped = String(pose.grip);
    // Explicit endpoints are useful for inspecting the continuous hand/prop constraint.
    disc.dataset.center = `${center.x},${center.y}`;
    $('right-arm').dataset.wrist = `${wrist.x},${wrist.y}`;
  }

  function at(time) {
    let offset = 0;
    for (let i = 0; i < stages.length; i++) {
      const end = offset + stages[i][1];
      if (time < end || i === stages.length - 1) return { index: i, t: clamp((time - offset) / stages[i][1]) };
      offset = end;
    }
  }

  function update(time) {
    const { index, t } = at(time);
    render(sample(index, t));
    $('scene').dataset.phase = stages[index][0];
    $('phase').textContent = stages[index][0].replaceAll('-', ' ');
    $('elapsed').textContent = `${(time / 1000).toFixed(2)} / ${(total / 1000).toFixed(2)} s`;
    $('progress').style.width = `${100 * time / total}%`;
  }

  function cancel() { cancelAnimationFrame(frame); runId++; $('scene').dataset.running = 'false'; }
  function reset() {
    cancel(); const pose = neutral(); pose.x = -1000; render(pose);
    $('scene').dataset.phase = 'ready'; $('phase').textContent = 'Ready · offstage';
    $('elapsed').textContent = `0.00 / ${(total / 1000).toFixed(2)} s`; $('progress').style.width = '0%';
  }
  function play(from, to) {
    cancel(); const id = runId, start = performance.now();
    $('scene').dataset.running = 'true'; update(from);
    function tick(now) {
      if (id !== runId) return;
      const time = Math.min(to, from + now - start); update(time);
      if (time < to) frame = requestAnimationFrame(tick);
      else {
        $('scene').dataset.running = 'false';
        if (to === 2050) $('phase').textContent = 'walk and settle · finished';
        else if (to === 2550) $('phase').textContent = 'sit · finished';
        else $('phase').textContent = 'hold disc · finished';
      }
    }
    frame = requestAnimationFrame(tick);
  }

  const actions = { full: () => play(0, total), reset,
    walk: () => play(0, 2050), sit: () => play(2050, 2550), pull: () => play(2550, total) };
  document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => actions[button.dataset.action]()));
  // No autoplay: reduced-motion users also choose when the short study runs.
  window.addEventListener('pagehide', cancel);
  reset();
})();
