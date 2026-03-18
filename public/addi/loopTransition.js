const allLoopTransitionMapping = {
  loop_0000: [0, 189],
  loop_0003: [3, 186],
  loop_0006: [6, 9, 180, 183],
  loop_0012: [12, 177],
  loop_0015: [15, 174],
  loop_0018: [18, 171],
  loop_0021: [21, 168],
  loop_0024: [24, 165],
  loop_0027: [27, 162],
  loop_0030: [30, 159],
  loop_0033: [33, 156],
  loop_0036: [36, 153],
  loop_0039: [39, 150],
  loop_0042: [42, 147],
  loop_0045: [45, 144],
  loop_0048: [48, 141],
  loop_0051: [51, 138],
  loop_0054: [54, 135],
  loop_0057: [57, 132],
  loop_0060: [60, 63, 126, 129],
  loop_0066: [66, 123],
  loop_0069: [69, 120],
  loop_0072: [72, 75, 78, 111, 114, 117],
  loop_0081: [81, 108],
  loop_0084: [84, 105],
  loop_0087: [87, 102],
  loop_0090: [90, 93, 96, 99],
};

const availableLoopTransitions = [
  "loop_0006",
  "loop_0015",
  "loop_0027",
  "loop_0039",
  "loop_0060",
  "loop_0072",
  "loop_0081",
  "loop_0090",
];

export const loopTransitionMapping = availableLoopTransitions.reduce(
  (acc, key) => {
    acc[key] = allLoopTransitionMapping[key];
    return acc;
  },
  {}
);
