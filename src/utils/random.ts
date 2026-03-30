export function getRandomItem<T>(arr: T[]): T {
  if (arr.length === 0)
    throw new Error("Cannot get random item from empty array");

  const res = arr[Math.floor(Math.random() * arr.length)];
  if (res === undefined)
    throw new Error("Unexpected undefined value when getting random item");

  return res;
}

export function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
