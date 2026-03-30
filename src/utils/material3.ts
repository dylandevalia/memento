import { getRandomItem } from "@/utils/random";

const MATERIAL3_BRIGHT_COLORS = [
  "--mui-red",
  "--mui-pink",
  "--mui-purple",
  "--mui-deep-purple",
  "--mui-indigo",
  "--mui-blue",
  "--mui-light-blue",
  "--mui-cyan",
  "--mui-teal",
  "--mui-green",
  "--mui-light-green",
  "--mui-lime",
  // "--mui-yellow",
  "--mui-amber",
  "--mui-orange",
  "--mui-deep-orange",
];

export function getRandomBaseColor() {
  return getRandomItem(MATERIAL3_BRIGHT_COLORS);
}

export function getRandomColor(shade: number = 500) {
  const randomColor = getRandomBaseColor();
  return `rgb(var(${randomColor}-${shade}))`;
}

export function getRandomShade() {
  const shades = [100, 200, 300, 400, 500, 600, 700, 800, 900];
  return getRandomItem(shades);
}
