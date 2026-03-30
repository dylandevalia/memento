import { getRandomInt } from "@/utils/random";
import "./particles.css";
import { getRandomBaseColor, getRandomShade } from "@/utils/material3";

const PARTICLE_CONTAINER_ID = "cloud-particle-container";
const PARTICLE_POOL_SIZE = 100;
const MAX_PARTICLES_PER_EFFECT = PARTICLE_POOL_SIZE / 2;
const ANIMATION_DURATION = 1000;

const styles = {
  containerClass: "particleContainer",
  particleClass: "cloudParticle",
  animationClass: "cloudExpand",
};

/**
 * Creates a particle container element with a pre-created pool of particles.
 * Uses round-robin selection to distribute particle usage evenly.
 */
export function getParticleContainer(): HTMLElement {
  let container = document.getElementById(PARTICLE_CONTAINER_ID);
  if (!container) {
    container = document.createElement("div");
    container.id = PARTICLE_CONTAINER_ID;
    container.className = styles.containerClass;
    container.dataset.nextParticleIndex = "0";
    document.body.appendChild(container);

    // Pre-create particle pool
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      const cloud = document.createElement("div");
      cloud.className = styles.particleClass;
      cloud.style.visibility = "hidden";
      container.appendChild(cloud);
    }
  }
  return container;
}

/**
 * Calculates the distance to the perimeter of a rectangle at a given angle.
 */
function getPerimeterDistance(angle: number, width: number): number {
  const absCosTerm = Math.abs(Math.cos(angle));
  const absSinTerm = Math.abs(Math.sin(angle));
  return width / 2 / Math.max(absCosTerm, absSinTerm);
}

/**
 * Plays a cloud puff particle effect from an element.
 */
export function playCloudPuff(
  element: HTMLElement,
  wrapperClass: string,
): void {
  const container = element.closest(`.${wrapperClass}`);
  if (!container) {
    console.error("Could not find wrapper for element:", element);
    return;
  }

  const rect = container.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  // Calculate number of particles based on perimeter
  const numClouds = Math.min(
    Math.floor((rect.width * 2 + rect.height * 2) / 20),
    MAX_PARTICLES_PER_EFFECT,
  );

  const color = getRandomBaseColor();
  const particleContainer = getParticleContainer();
  const particles: HTMLDivElement[] = [];

  // Get the next available particle index from the pool
  const poolSize = particleContainer.children.length;
  const nextIndex = Number.parseInt(
    particleContainer.dataset.nextParticleIndex || "0",
    10,
  );

  for (let i = 0; i < numClouds; i++) {
    // Calculate angle with randomization for natural distribution
    const baseAngle = (Math.PI * 2 * i) / numClouds;
    const angleOffset = (Math.random() - 0.5) * 0.5;
    const angle = baseAngle + angleOffset;

    // Calculate starting position along the perimeter
    const perimeterDist = getPerimeterDistance(angle, rect.width);
    const startX = centerX + Math.cos(angle) * perimeterDist;
    const startY = centerY + Math.sin(angle) * perimeterDist;

    // Calculate end position (move outward from perimeter)
    const travelDist = Math.random() * rect.width * 0.5;
    const endX = startX + Math.cos(angle) * travelDist;
    const endY = startY + Math.sin(angle) * travelDist;

    // Calculate transform deltas for GPU-accelerated animation
    const deltaX = endX - startX;
    const deltaY = endY - startY;

    // Get particle from pool using round-robin selection
    const particleIndex = (nextIndex + i) % poolSize;
    const cloud = particleContainer.children[particleIndex] as HTMLDivElement;
    const duration = getRandomInt(ANIMATION_DURATION * 0.5, ANIMATION_DURATION);

    cloud.style.cssText = `
      visibility: visible;
      width: ${getRandomInt(8, 32)}px;
      left: ${startX}px;
      top: ${startY}px;
      --translate-x: ${deltaX}px;
      --translate-y: ${deltaY}px;
      --color: var(${color}-${getRandomShade()});
      animation: ${styles.animationClass} ${duration}ms ease-out forwards;
    `;

    particles.push(cloud);
  }

  // Update next particle index for the pool
  particleContainer.dataset.nextParticleIndex = String(
    (nextIndex + numClouds) % poolSize,
  );

  // Hide particles after animation completes
  setTimeout(() => {
    particles.forEach((p) => {
      p.style.visibility = "hidden";
      p.style.animation = "none";
    });
  }, ANIMATION_DURATION);
}
