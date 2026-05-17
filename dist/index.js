#!/usr/bin/env node
import { createRequire as __WEBPACK_EXTERNAL_createRequire } from "module";
/******/ var __webpack_modules__ = ({

/***/ 21:
/***/ ((module) => {



module.exports = ({onlyFirst = false} = {}) => {
	const pattern = [
		'[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
		'(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))'
	].join('|');

	return new RegExp(pattern, onlyFirst ? undefined : 'g');
};


/***/ }),

/***/ 4412:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

/* module decorator */ module = __nccwpck_require__.nmd(module);


const wrapAnsi16 = (fn, offset) => (...args) => {
	const code = fn(...args);
	return `\u001B[${code + offset}m`;
};

const wrapAnsi256 = (fn, offset) => (...args) => {
	const code = fn(...args);
	return `\u001B[${38 + offset};5;${code}m`;
};

const wrapAnsi16m = (fn, offset) => (...args) => {
	const rgb = fn(...args);
	return `\u001B[${38 + offset};2;${rgb[0]};${rgb[1]};${rgb[2]}m`;
};

const ansi2ansi = n => n;
const rgb2rgb = (r, g, b) => [r, g, b];

const setLazyProperty = (object, property, get) => {
	Object.defineProperty(object, property, {
		get: () => {
			const value = get();

			Object.defineProperty(object, property, {
				value,
				enumerable: true,
				configurable: true
			});

			return value;
		},
		enumerable: true,
		configurable: true
	});
};

/** @type {typeof import('color-convert')} */
let colorConvert;
const makeDynamicStyles = (wrap, targetSpace, identity, isBackground) => {
	if (colorConvert === undefined) {
		colorConvert = __nccwpck_require__(4185);
	}

	const offset = isBackground ? 10 : 0;
	const styles = {};

	for (const [sourceSpace, suite] of Object.entries(colorConvert)) {
		const name = sourceSpace === 'ansi16' ? 'ansi' : sourceSpace;
		if (sourceSpace === targetSpace) {
			styles[name] = wrap(identity, offset);
		} else if (typeof suite === 'object') {
			styles[name] = wrap(suite[targetSpace], offset);
		}
	}

	return styles;
};

function assembleStyles() {
	const codes = new Map();
	const styles = {
		modifier: {
			reset: [0, 0],
			// 21 isn't widely supported and 22 does the same thing
			bold: [1, 22],
			dim: [2, 22],
			italic: [3, 23],
			underline: [4, 24],
			inverse: [7, 27],
			hidden: [8, 28],
			strikethrough: [9, 29]
		},
		color: {
			black: [30, 39],
			red: [31, 39],
			green: [32, 39],
			yellow: [33, 39],
			blue: [34, 39],
			magenta: [35, 39],
			cyan: [36, 39],
			white: [37, 39],

			// Bright color
			blackBright: [90, 39],
			redBright: [91, 39],
			greenBright: [92, 39],
			yellowBright: [93, 39],
			blueBright: [94, 39],
			magentaBright: [95, 39],
			cyanBright: [96, 39],
			whiteBright: [97, 39]
		},
		bgColor: {
			bgBlack: [40, 49],
			bgRed: [41, 49],
			bgGreen: [42, 49],
			bgYellow: [43, 49],
			bgBlue: [44, 49],
			bgMagenta: [45, 49],
			bgCyan: [46, 49],
			bgWhite: [47, 49],

			// Bright color
			bgBlackBright: [100, 49],
			bgRedBright: [101, 49],
			bgGreenBright: [102, 49],
			bgYellowBright: [103, 49],
			bgBlueBright: [104, 49],
			bgMagentaBright: [105, 49],
			bgCyanBright: [106, 49],
			bgWhiteBright: [107, 49]
		}
	};

	// Alias bright black as gray (and grey)
	styles.color.gray = styles.color.blackBright;
	styles.bgColor.bgGray = styles.bgColor.bgBlackBright;
	styles.color.grey = styles.color.blackBright;
	styles.bgColor.bgGrey = styles.bgColor.bgBlackBright;

	for (const [groupName, group] of Object.entries(styles)) {
		for (const [styleName, style] of Object.entries(group)) {
			styles[styleName] = {
				open: `\u001B[${style[0]}m`,
				close: `\u001B[${style[1]}m`
			};

			group[styleName] = styles[styleName];

			codes.set(style[0], style[1]);
		}

		Object.defineProperty(styles, groupName, {
			value: group,
			enumerable: false
		});
	}

	Object.defineProperty(styles, 'codes', {
		value: codes,
		enumerable: false
	});

	styles.color.close = '\u001B[39m';
	styles.bgColor.close = '\u001B[49m';

	setLazyProperty(styles.color, 'ansi', () => makeDynamicStyles(wrapAnsi16, 'ansi16', ansi2ansi, false));
	setLazyProperty(styles.color, 'ansi256', () => makeDynamicStyles(wrapAnsi256, 'ansi256', ansi2ansi, false));
	setLazyProperty(styles.color, 'ansi16m', () => makeDynamicStyles(wrapAnsi16m, 'rgb', rgb2rgb, false));
	setLazyProperty(styles.bgColor, 'ansi', () => makeDynamicStyles(wrapAnsi16, 'ansi16', ansi2ansi, true));
	setLazyProperty(styles.bgColor, 'ansi256', () => makeDynamicStyles(wrapAnsi256, 'ansi256', ansi2ansi, true));
	setLazyProperty(styles.bgColor, 'ansi16m', () => makeDynamicStyles(wrapAnsi16m, 'rgb', rgb2rgb, true));

	return styles;
}

// Make the export immutable
Object.defineProperty(module, 'exports', {
	enumerable: true,
	get: assembleStyles
});


/***/ }),

/***/ 8493:
/***/ ((module) => {


const regex = '[\uD800-\uDBFF][\uDC00-\uDFFF]';

const astralRegex = options => options && options.exact ? new RegExp(`^${regex}$`) : new RegExp(regex, 'g');

module.exports = astralRegex;


/***/ }),

/***/ 6872:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

/* MIT license */
/* eslint-disable no-mixed-operators */
const cssKeywords = __nccwpck_require__(4953);

// NOTE: conversions should only return primitive values (i.e. arrays, or
//       values that give correct `typeof` results).
//       do not use box values types (i.e. Number(), String(), etc.)

const reverseKeywords = {};
for (const key of Object.keys(cssKeywords)) {
	reverseKeywords[cssKeywords[key]] = key;
}

const convert = {
	rgb: {channels: 3, labels: 'rgb'},
	hsl: {channels: 3, labels: 'hsl'},
	hsv: {channels: 3, labels: 'hsv'},
	hwb: {channels: 3, labels: 'hwb'},
	cmyk: {channels: 4, labels: 'cmyk'},
	xyz: {channels: 3, labels: 'xyz'},
	lab: {channels: 3, labels: 'lab'},
	lch: {channels: 3, labels: 'lch'},
	hex: {channels: 1, labels: ['hex']},
	keyword: {channels: 1, labels: ['keyword']},
	ansi16: {channels: 1, labels: ['ansi16']},
	ansi256: {channels: 1, labels: ['ansi256']},
	hcg: {channels: 3, labels: ['h', 'c', 'g']},
	apple: {channels: 3, labels: ['r16', 'g16', 'b16']},
	gray: {channels: 1, labels: ['gray']}
};

module.exports = convert;

// Hide .channels and .labels properties
for (const model of Object.keys(convert)) {
	if (!('channels' in convert[model])) {
		throw new Error('missing channels property: ' + model);
	}

	if (!('labels' in convert[model])) {
		throw new Error('missing channel labels property: ' + model);
	}

	if (convert[model].labels.length !== convert[model].channels) {
		throw new Error('channel and label counts mismatch: ' + model);
	}

	const {channels, labels} = convert[model];
	delete convert[model].channels;
	delete convert[model].labels;
	Object.defineProperty(convert[model], 'channels', {value: channels});
	Object.defineProperty(convert[model], 'labels', {value: labels});
}

convert.rgb.hsl = function (rgb) {
	const r = rgb[0] / 255;
	const g = rgb[1] / 255;
	const b = rgb[2] / 255;
	const min = Math.min(r, g, b);
	const max = Math.max(r, g, b);
	const delta = max - min;
	let h;
	let s;

	if (max === min) {
		h = 0;
	} else if (r === max) {
		h = (g - b) / delta;
	} else if (g === max) {
		h = 2 + (b - r) / delta;
	} else if (b === max) {
		h = 4 + (r - g) / delta;
	}

	h = Math.min(h * 60, 360);

	if (h < 0) {
		h += 360;
	}

	const l = (min + max) / 2;

	if (max === min) {
		s = 0;
	} else if (l <= 0.5) {
		s = delta / (max + min);
	} else {
		s = delta / (2 - max - min);
	}

	return [h, s * 100, l * 100];
};

convert.rgb.hsv = function (rgb) {
	let rdif;
	let gdif;
	let bdif;
	let h;
	let s;

	const r = rgb[0] / 255;
	const g = rgb[1] / 255;
	const b = rgb[2] / 255;
	const v = Math.max(r, g, b);
	const diff = v - Math.min(r, g, b);
	const diffc = function (c) {
		return (v - c) / 6 / diff + 1 / 2;
	};

	if (diff === 0) {
		h = 0;
		s = 0;
	} else {
		s = diff / v;
		rdif = diffc(r);
		gdif = diffc(g);
		bdif = diffc(b);

		if (r === v) {
			h = bdif - gdif;
		} else if (g === v) {
			h = (1 / 3) + rdif - bdif;
		} else if (b === v) {
			h = (2 / 3) + gdif - rdif;
		}

		if (h < 0) {
			h += 1;
		} else if (h > 1) {
			h -= 1;
		}
	}

	return [
		h * 360,
		s * 100,
		v * 100
	];
};

convert.rgb.hwb = function (rgb) {
	const r = rgb[0];
	const g = rgb[1];
	let b = rgb[2];
	const h = convert.rgb.hsl(rgb)[0];
	const w = 1 / 255 * Math.min(r, Math.min(g, b));

	b = 1 - 1 / 255 * Math.max(r, Math.max(g, b));

	return [h, w * 100, b * 100];
};

convert.rgb.cmyk = function (rgb) {
	const r = rgb[0] / 255;
	const g = rgb[1] / 255;
	const b = rgb[2] / 255;

	const k = Math.min(1 - r, 1 - g, 1 - b);
	const c = (1 - r - k) / (1 - k) || 0;
	const m = (1 - g - k) / (1 - k) || 0;
	const y = (1 - b - k) / (1 - k) || 0;

	return [c * 100, m * 100, y * 100, k * 100];
};

function comparativeDistance(x, y) {
	/*
		See https://en.m.wikipedia.org/wiki/Euclidean_distance#Squared_Euclidean_distance
	*/
	return (
		((x[0] - y[0]) ** 2) +
		((x[1] - y[1]) ** 2) +
		((x[2] - y[2]) ** 2)
	);
}

convert.rgb.keyword = function (rgb) {
	const reversed = reverseKeywords[rgb];
	if (reversed) {
		return reversed;
	}

	let currentClosestDistance = Infinity;
	let currentClosestKeyword;

	for (const keyword of Object.keys(cssKeywords)) {
		const value = cssKeywords[keyword];

		// Compute comparative distance
		const distance = comparativeDistance(rgb, value);

		// Check if its less, if so set as closest
		if (distance < currentClosestDistance) {
			currentClosestDistance = distance;
			currentClosestKeyword = keyword;
		}
	}

	return currentClosestKeyword;
};

convert.keyword.rgb = function (keyword) {
	return cssKeywords[keyword];
};

convert.rgb.xyz = function (rgb) {
	let r = rgb[0] / 255;
	let g = rgb[1] / 255;
	let b = rgb[2] / 255;

	// Assume sRGB
	r = r > 0.04045 ? (((r + 0.055) / 1.055) ** 2.4) : (r / 12.92);
	g = g > 0.04045 ? (((g + 0.055) / 1.055) ** 2.4) : (g / 12.92);
	b = b > 0.04045 ? (((b + 0.055) / 1.055) ** 2.4) : (b / 12.92);

	const x = (r * 0.4124) + (g * 0.3576) + (b * 0.1805);
	const y = (r * 0.2126) + (g * 0.7152) + (b * 0.0722);
	const z = (r * 0.0193) + (g * 0.1192) + (b * 0.9505);

	return [x * 100, y * 100, z * 100];
};

convert.rgb.lab = function (rgb) {
	const xyz = convert.rgb.xyz(rgb);
	let x = xyz[0];
	let y = xyz[1];
	let z = xyz[2];

	x /= 95.047;
	y /= 100;
	z /= 108.883;

	x = x > 0.008856 ? (x ** (1 / 3)) : (7.787 * x) + (16 / 116);
	y = y > 0.008856 ? (y ** (1 / 3)) : (7.787 * y) + (16 / 116);
	z = z > 0.008856 ? (z ** (1 / 3)) : (7.787 * z) + (16 / 116);

	const l = (116 * y) - 16;
	const a = 500 * (x - y);
	const b = 200 * (y - z);

	return [l, a, b];
};

convert.hsl.rgb = function (hsl) {
	const h = hsl[0] / 360;
	const s = hsl[1] / 100;
	const l = hsl[2] / 100;
	let t2;
	let t3;
	let val;

	if (s === 0) {
		val = l * 255;
		return [val, val, val];
	}

	if (l < 0.5) {
		t2 = l * (1 + s);
	} else {
		t2 = l + s - l * s;
	}

	const t1 = 2 * l - t2;

	const rgb = [0, 0, 0];
	for (let i = 0; i < 3; i++) {
		t3 = h + 1 / 3 * -(i - 1);
		if (t3 < 0) {
			t3++;
		}

		if (t3 > 1) {
			t3--;
		}

		if (6 * t3 < 1) {
			val = t1 + (t2 - t1) * 6 * t3;
		} else if (2 * t3 < 1) {
			val = t2;
		} else if (3 * t3 < 2) {
			val = t1 + (t2 - t1) * (2 / 3 - t3) * 6;
		} else {
			val = t1;
		}

		rgb[i] = val * 255;
	}

	return rgb;
};

convert.hsl.hsv = function (hsl) {
	const h = hsl[0];
	let s = hsl[1] / 100;
	let l = hsl[2] / 100;
	let smin = s;
	const lmin = Math.max(l, 0.01);

	l *= 2;
	s *= (l <= 1) ? l : 2 - l;
	smin *= lmin <= 1 ? lmin : 2 - lmin;
	const v = (l + s) / 2;
	const sv = l === 0 ? (2 * smin) / (lmin + smin) : (2 * s) / (l + s);

	return [h, sv * 100, v * 100];
};

convert.hsv.rgb = function (hsv) {
	const h = hsv[0] / 60;
	const s = hsv[1] / 100;
	let v = hsv[2] / 100;
	const hi = Math.floor(h) % 6;

	const f = h - Math.floor(h);
	const p = 255 * v * (1 - s);
	const q = 255 * v * (1 - (s * f));
	const t = 255 * v * (1 - (s * (1 - f)));
	v *= 255;

	switch (hi) {
		case 0:
			return [v, t, p];
		case 1:
			return [q, v, p];
		case 2:
			return [p, v, t];
		case 3:
			return [p, q, v];
		case 4:
			return [t, p, v];
		case 5:
			return [v, p, q];
	}
};

convert.hsv.hsl = function (hsv) {
	const h = hsv[0];
	const s = hsv[1] / 100;
	const v = hsv[2] / 100;
	const vmin = Math.max(v, 0.01);
	let sl;
	let l;

	l = (2 - s) * v;
	const lmin = (2 - s) * vmin;
	sl = s * vmin;
	sl /= (lmin <= 1) ? lmin : 2 - lmin;
	sl = sl || 0;
	l /= 2;

	return [h, sl * 100, l * 100];
};

// http://dev.w3.org/csswg/css-color/#hwb-to-rgb
convert.hwb.rgb = function (hwb) {
	const h = hwb[0] / 360;
	let wh = hwb[1] / 100;
	let bl = hwb[2] / 100;
	const ratio = wh + bl;
	let f;

	// Wh + bl cant be > 1
	if (ratio > 1) {
		wh /= ratio;
		bl /= ratio;
	}

	const i = Math.floor(6 * h);
	const v = 1 - bl;
	f = 6 * h - i;

	if ((i & 0x01) !== 0) {
		f = 1 - f;
	}

	const n = wh + f * (v - wh); // Linear interpolation

	let r;
	let g;
	let b;
	/* eslint-disable max-statements-per-line,no-multi-spaces */
	switch (i) {
		default:
		case 6:
		case 0: r = v;  g = n;  b = wh; break;
		case 1: r = n;  g = v;  b = wh; break;
		case 2: r = wh; g = v;  b = n; break;
		case 3: r = wh; g = n;  b = v; break;
		case 4: r = n;  g = wh; b = v; break;
		case 5: r = v;  g = wh; b = n; break;
	}
	/* eslint-enable max-statements-per-line,no-multi-spaces */

	return [r * 255, g * 255, b * 255];
};

convert.cmyk.rgb = function (cmyk) {
	const c = cmyk[0] / 100;
	const m = cmyk[1] / 100;
	const y = cmyk[2] / 100;
	const k = cmyk[3] / 100;

	const r = 1 - Math.min(1, c * (1 - k) + k);
	const g = 1 - Math.min(1, m * (1 - k) + k);
	const b = 1 - Math.min(1, y * (1 - k) + k);

	return [r * 255, g * 255, b * 255];
};

convert.xyz.rgb = function (xyz) {
	const x = xyz[0] / 100;
	const y = xyz[1] / 100;
	const z = xyz[2] / 100;
	let r;
	let g;
	let b;

	r = (x * 3.2406) + (y * -1.5372) + (z * -0.4986);
	g = (x * -0.9689) + (y * 1.8758) + (z * 0.0415);
	b = (x * 0.0557) + (y * -0.2040) + (z * 1.0570);

	// Assume sRGB
	r = r > 0.0031308
		? ((1.055 * (r ** (1.0 / 2.4))) - 0.055)
		: r * 12.92;

	g = g > 0.0031308
		? ((1.055 * (g ** (1.0 / 2.4))) - 0.055)
		: g * 12.92;

	b = b > 0.0031308
		? ((1.055 * (b ** (1.0 / 2.4))) - 0.055)
		: b * 12.92;

	r = Math.min(Math.max(0, r), 1);
	g = Math.min(Math.max(0, g), 1);
	b = Math.min(Math.max(0, b), 1);

	return [r * 255, g * 255, b * 255];
};

convert.xyz.lab = function (xyz) {
	let x = xyz[0];
	let y = xyz[1];
	let z = xyz[2];

	x /= 95.047;
	y /= 100;
	z /= 108.883;

	x = x > 0.008856 ? (x ** (1 / 3)) : (7.787 * x) + (16 / 116);
	y = y > 0.008856 ? (y ** (1 / 3)) : (7.787 * y) + (16 / 116);
	z = z > 0.008856 ? (z ** (1 / 3)) : (7.787 * z) + (16 / 116);

	const l = (116 * y) - 16;
	const a = 500 * (x - y);
	const b = 200 * (y - z);

	return [l, a, b];
};

convert.lab.xyz = function (lab) {
	const l = lab[0];
	const a = lab[1];
	const b = lab[2];
	let x;
	let y;
	let z;

	y = (l + 16) / 116;
	x = a / 500 + y;
	z = y - b / 200;

	const y2 = y ** 3;
	const x2 = x ** 3;
	const z2 = z ** 3;
	y = y2 > 0.008856 ? y2 : (y - 16 / 116) / 7.787;
	x = x2 > 0.008856 ? x2 : (x - 16 / 116) / 7.787;
	z = z2 > 0.008856 ? z2 : (z - 16 / 116) / 7.787;

	x *= 95.047;
	y *= 100;
	z *= 108.883;

	return [x, y, z];
};

convert.lab.lch = function (lab) {
	const l = lab[0];
	const a = lab[1];
	const b = lab[2];
	let h;

	const hr = Math.atan2(b, a);
	h = hr * 360 / 2 / Math.PI;

	if (h < 0) {
		h += 360;
	}

	const c = Math.sqrt(a * a + b * b);

	return [l, c, h];
};

convert.lch.lab = function (lch) {
	const l = lch[0];
	const c = lch[1];
	const h = lch[2];

	const hr = h / 360 * 2 * Math.PI;
	const a = c * Math.cos(hr);
	const b = c * Math.sin(hr);

	return [l, a, b];
};

convert.rgb.ansi16 = function (args, saturation = null) {
	const [r, g, b] = args;
	let value = saturation === null ? convert.rgb.hsv(args)[2] : saturation; // Hsv -> ansi16 optimization

	value = Math.round(value / 50);

	if (value === 0) {
		return 30;
	}

	let ansi = 30
		+ ((Math.round(b / 255) << 2)
		| (Math.round(g / 255) << 1)
		| Math.round(r / 255));

	if (value === 2) {
		ansi += 60;
	}

	return ansi;
};

convert.hsv.ansi16 = function (args) {
	// Optimization here; we already know the value and don't need to get
	// it converted for us.
	return convert.rgb.ansi16(convert.hsv.rgb(args), args[2]);
};

convert.rgb.ansi256 = function (args) {
	const r = args[0];
	const g = args[1];
	const b = args[2];

	// We use the extended greyscale palette here, with the exception of
	// black and white. normal palette only has 4 greyscale shades.
	if (r === g && g === b) {
		if (r < 8) {
			return 16;
		}

		if (r > 248) {
			return 231;
		}

		return Math.round(((r - 8) / 247) * 24) + 232;
	}

	const ansi = 16
		+ (36 * Math.round(r / 255 * 5))
		+ (6 * Math.round(g / 255 * 5))
		+ Math.round(b / 255 * 5);

	return ansi;
};

convert.ansi16.rgb = function (args) {
	let color = args % 10;

	// Handle greyscale
	if (color === 0 || color === 7) {
		if (args > 50) {
			color += 3.5;
		}

		color = color / 10.5 * 255;

		return [color, color, color];
	}

	const mult = (~~(args > 50) + 1) * 0.5;
	const r = ((color & 1) * mult) * 255;
	const g = (((color >> 1) & 1) * mult) * 255;
	const b = (((color >> 2) & 1) * mult) * 255;

	return [r, g, b];
};

convert.ansi256.rgb = function (args) {
	// Handle greyscale
	if (args >= 232) {
		const c = (args - 232) * 10 + 8;
		return [c, c, c];
	}

	args -= 16;

	let rem;
	const r = Math.floor(args / 36) / 5 * 255;
	const g = Math.floor((rem = args % 36) / 6) / 5 * 255;
	const b = (rem % 6) / 5 * 255;

	return [r, g, b];
};

convert.rgb.hex = function (args) {
	const integer = ((Math.round(args[0]) & 0xFF) << 16)
		+ ((Math.round(args[1]) & 0xFF) << 8)
		+ (Math.round(args[2]) & 0xFF);

	const string = integer.toString(16).toUpperCase();
	return '000000'.substring(string.length) + string;
};

convert.hex.rgb = function (args) {
	const match = args.toString(16).match(/[a-f0-9]{6}|[a-f0-9]{3}/i);
	if (!match) {
		return [0, 0, 0];
	}

	let colorString = match[0];

	if (match[0].length === 3) {
		colorString = colorString.split('').map(char => {
			return char + char;
		}).join('');
	}

	const integer = parseInt(colorString, 16);
	const r = (integer >> 16) & 0xFF;
	const g = (integer >> 8) & 0xFF;
	const b = integer & 0xFF;

	return [r, g, b];
};

convert.rgb.hcg = function (rgb) {
	const r = rgb[0] / 255;
	const g = rgb[1] / 255;
	const b = rgb[2] / 255;
	const max = Math.max(Math.max(r, g), b);
	const min = Math.min(Math.min(r, g), b);
	const chroma = (max - min);
	let grayscale;
	let hue;

	if (chroma < 1) {
		grayscale = min / (1 - chroma);
	} else {
		grayscale = 0;
	}

	if (chroma <= 0) {
		hue = 0;
	} else
	if (max === r) {
		hue = ((g - b) / chroma) % 6;
	} else
	if (max === g) {
		hue = 2 + (b - r) / chroma;
	} else {
		hue = 4 + (r - g) / chroma;
	}

	hue /= 6;
	hue %= 1;

	return [hue * 360, chroma * 100, grayscale * 100];
};

convert.hsl.hcg = function (hsl) {
	const s = hsl[1] / 100;
	const l = hsl[2] / 100;

	const c = l < 0.5 ? (2.0 * s * l) : (2.0 * s * (1.0 - l));

	let f = 0;
	if (c < 1.0) {
		f = (l - 0.5 * c) / (1.0 - c);
	}

	return [hsl[0], c * 100, f * 100];
};

convert.hsv.hcg = function (hsv) {
	const s = hsv[1] / 100;
	const v = hsv[2] / 100;

	const c = s * v;
	let f = 0;

	if (c < 1.0) {
		f = (v - c) / (1 - c);
	}

	return [hsv[0], c * 100, f * 100];
};

convert.hcg.rgb = function (hcg) {
	const h = hcg[0] / 360;
	const c = hcg[1] / 100;
	const g = hcg[2] / 100;

	if (c === 0.0) {
		return [g * 255, g * 255, g * 255];
	}

	const pure = [0, 0, 0];
	const hi = (h % 1) * 6;
	const v = hi % 1;
	const w = 1 - v;
	let mg = 0;

	/* eslint-disable max-statements-per-line */
	switch (Math.floor(hi)) {
		case 0:
			pure[0] = 1; pure[1] = v; pure[2] = 0; break;
		case 1:
			pure[0] = w; pure[1] = 1; pure[2] = 0; break;
		case 2:
			pure[0] = 0; pure[1] = 1; pure[2] = v; break;
		case 3:
			pure[0] = 0; pure[1] = w; pure[2] = 1; break;
		case 4:
			pure[0] = v; pure[1] = 0; pure[2] = 1; break;
		default:
			pure[0] = 1; pure[1] = 0; pure[2] = w;
	}
	/* eslint-enable max-statements-per-line */

	mg = (1.0 - c) * g;

	return [
		(c * pure[0] + mg) * 255,
		(c * pure[1] + mg) * 255,
		(c * pure[2] + mg) * 255
	];
};

convert.hcg.hsv = function (hcg) {
	const c = hcg[1] / 100;
	const g = hcg[2] / 100;

	const v = c + g * (1.0 - c);
	let f = 0;

	if (v > 0.0) {
		f = c / v;
	}

	return [hcg[0], f * 100, v * 100];
};

convert.hcg.hsl = function (hcg) {
	const c = hcg[1] / 100;
	const g = hcg[2] / 100;

	const l = g * (1.0 - c) + 0.5 * c;
	let s = 0;

	if (l > 0.0 && l < 0.5) {
		s = c / (2 * l);
	} else
	if (l >= 0.5 && l < 1.0) {
		s = c / (2 * (1 - l));
	}

	return [hcg[0], s * 100, l * 100];
};

convert.hcg.hwb = function (hcg) {
	const c = hcg[1] / 100;
	const g = hcg[2] / 100;
	const v = c + g * (1.0 - c);
	return [hcg[0], (v - c) * 100, (1 - v) * 100];
};

convert.hwb.hcg = function (hwb) {
	const w = hwb[1] / 100;
	const b = hwb[2] / 100;
	const v = 1 - b;
	const c = v - w;
	let g = 0;

	if (c < 1) {
		g = (v - c) / (1 - c);
	}

	return [hwb[0], c * 100, g * 100];
};

convert.apple.rgb = function (apple) {
	return [(apple[0] / 65535) * 255, (apple[1] / 65535) * 255, (apple[2] / 65535) * 255];
};

convert.rgb.apple = function (rgb) {
	return [(rgb[0] / 255) * 65535, (rgb[1] / 255) * 65535, (rgb[2] / 255) * 65535];
};

convert.gray.rgb = function (args) {
	return [args[0] / 100 * 255, args[0] / 100 * 255, args[0] / 100 * 255];
};

convert.gray.hsl = function (args) {
	return [0, 0, args[0]];
};

convert.gray.hsv = convert.gray.hsl;

convert.gray.hwb = function (gray) {
	return [0, 100, gray[0]];
};

convert.gray.cmyk = function (gray) {
	return [0, 0, 0, gray[0]];
};

convert.gray.lab = function (gray) {
	return [gray[0], 0, 0];
};

convert.gray.hex = function (gray) {
	const val = Math.round(gray[0] / 100 * 255) & 0xFF;
	const integer = (val << 16) + (val << 8) + val;

	const string = integer.toString(16).toUpperCase();
	return '000000'.substring(string.length) + string;
};

convert.rgb.gray = function (rgb) {
	const val = (rgb[0] + rgb[1] + rgb[2]) / 3;
	return [val / 255 * 100];
};


/***/ }),

/***/ 4185:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const conversions = __nccwpck_require__(6872);
const route = __nccwpck_require__(4200);

const convert = {};

const models = Object.keys(conversions);

function wrapRaw(fn) {
	const wrappedFn = function (...args) {
		const arg0 = args[0];
		if (arg0 === undefined || arg0 === null) {
			return arg0;
		}

		if (arg0.length > 1) {
			args = arg0;
		}

		return fn(args);
	};

	// Preserve .conversion property if there is one
	if ('conversion' in fn) {
		wrappedFn.conversion = fn.conversion;
	}

	return wrappedFn;
}

function wrapRounded(fn) {
	const wrappedFn = function (...args) {
		const arg0 = args[0];

		if (arg0 === undefined || arg0 === null) {
			return arg0;
		}

		if (arg0.length > 1) {
			args = arg0;
		}

		const result = fn(args);

		// We're assuming the result is an array here.
		// see notice in conversions.js; don't use box types
		// in conversion functions.
		if (typeof result === 'object') {
			for (let len = result.length, i = 0; i < len; i++) {
				result[i] = Math.round(result[i]);
			}
		}

		return result;
	};

	// Preserve .conversion property if there is one
	if ('conversion' in fn) {
		wrappedFn.conversion = fn.conversion;
	}

	return wrappedFn;
}

models.forEach(fromModel => {
	convert[fromModel] = {};

	Object.defineProperty(convert[fromModel], 'channels', {value: conversions[fromModel].channels});
	Object.defineProperty(convert[fromModel], 'labels', {value: conversions[fromModel].labels});

	const routes = route(fromModel);
	const routeModels = Object.keys(routes);

	routeModels.forEach(toModel => {
		const fn = routes[toModel];

		convert[fromModel][toModel] = wrapRounded(fn);
		convert[fromModel][toModel].raw = wrapRaw(fn);
	});
});

module.exports = convert;


/***/ }),

/***/ 4200:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const conversions = __nccwpck_require__(6872);

/*
	This function routes a model to all other models.

	all functions that are routed have a property `.conversion` attached
	to the returned synthetic function. This property is an array
	of strings, each with the steps in between the 'from' and 'to'
	color models (inclusive).

	conversions that are not possible simply are not included.
*/

function buildGraph() {
	const graph = {};
	// https://jsperf.com/object-keys-vs-for-in-with-closure/3
	const models = Object.keys(conversions);

	for (let len = models.length, i = 0; i < len; i++) {
		graph[models[i]] = {
			// http://jsperf.com/1-vs-infinity
			// micro-opt, but this is simple.
			distance: -1,
			parent: null
		};
	}

	return graph;
}

// https://en.wikipedia.org/wiki/Breadth-first_search
function deriveBFS(fromModel) {
	const graph = buildGraph();
	const queue = [fromModel]; // Unshift -> queue -> pop

	graph[fromModel].distance = 0;

	while (queue.length) {
		const current = queue.pop();
		const adjacents = Object.keys(conversions[current]);

		for (let len = adjacents.length, i = 0; i < len; i++) {
			const adjacent = adjacents[i];
			const node = graph[adjacent];

			if (node.distance === -1) {
				node.distance = graph[current].distance + 1;
				node.parent = current;
				queue.unshift(adjacent);
			}
		}
	}

	return graph;
}

function link(from, to) {
	return function (args) {
		return to(from(args));
	};
}

function wrapConversion(toModel, graph) {
	const path = [graph[toModel].parent, toModel];
	let fn = conversions[graph[toModel].parent][toModel];

	let cur = graph[toModel].parent;
	while (graph[cur].parent) {
		path.unshift(graph[cur].parent);
		fn = link(conversions[graph[cur].parent][cur], fn);
		cur = graph[cur].parent;
	}

	fn.conversion = path;
	return fn;
}

module.exports = function (fromModel) {
	const graph = deriveBFS(fromModel);
	const conversion = {};

	const models = Object.keys(graph);
	for (let len = models.length, i = 0; i < len; i++) {
		const toModel = models[i];
		const node = graph[toModel];

		if (node.parent === null) {
			// No possible conversion, or this node is the source model.
			continue;
		}

		conversion[toModel] = wrapConversion(toModel, graph);
	}

	return conversion;
};



/***/ }),

/***/ 4953:
/***/ ((module) => {



module.exports = {
	"aliceblue": [240, 248, 255],
	"antiquewhite": [250, 235, 215],
	"aqua": [0, 255, 255],
	"aquamarine": [127, 255, 212],
	"azure": [240, 255, 255],
	"beige": [245, 245, 220],
	"bisque": [255, 228, 196],
	"black": [0, 0, 0],
	"blanchedalmond": [255, 235, 205],
	"blue": [0, 0, 255],
	"blueviolet": [138, 43, 226],
	"brown": [165, 42, 42],
	"burlywood": [222, 184, 135],
	"cadetblue": [95, 158, 160],
	"chartreuse": [127, 255, 0],
	"chocolate": [210, 105, 30],
	"coral": [255, 127, 80],
	"cornflowerblue": [100, 149, 237],
	"cornsilk": [255, 248, 220],
	"crimson": [220, 20, 60],
	"cyan": [0, 255, 255],
	"darkblue": [0, 0, 139],
	"darkcyan": [0, 139, 139],
	"darkgoldenrod": [184, 134, 11],
	"darkgray": [169, 169, 169],
	"darkgreen": [0, 100, 0],
	"darkgrey": [169, 169, 169],
	"darkkhaki": [189, 183, 107],
	"darkmagenta": [139, 0, 139],
	"darkolivegreen": [85, 107, 47],
	"darkorange": [255, 140, 0],
	"darkorchid": [153, 50, 204],
	"darkred": [139, 0, 0],
	"darksalmon": [233, 150, 122],
	"darkseagreen": [143, 188, 143],
	"darkslateblue": [72, 61, 139],
	"darkslategray": [47, 79, 79],
	"darkslategrey": [47, 79, 79],
	"darkturquoise": [0, 206, 209],
	"darkviolet": [148, 0, 211],
	"deeppink": [255, 20, 147],
	"deepskyblue": [0, 191, 255],
	"dimgray": [105, 105, 105],
	"dimgrey": [105, 105, 105],
	"dodgerblue": [30, 144, 255],
	"firebrick": [178, 34, 34],
	"floralwhite": [255, 250, 240],
	"forestgreen": [34, 139, 34],
	"fuchsia": [255, 0, 255],
	"gainsboro": [220, 220, 220],
	"ghostwhite": [248, 248, 255],
	"gold": [255, 215, 0],
	"goldenrod": [218, 165, 32],
	"gray": [128, 128, 128],
	"green": [0, 128, 0],
	"greenyellow": [173, 255, 47],
	"grey": [128, 128, 128],
	"honeydew": [240, 255, 240],
	"hotpink": [255, 105, 180],
	"indianred": [205, 92, 92],
	"indigo": [75, 0, 130],
	"ivory": [255, 255, 240],
	"khaki": [240, 230, 140],
	"lavender": [230, 230, 250],
	"lavenderblush": [255, 240, 245],
	"lawngreen": [124, 252, 0],
	"lemonchiffon": [255, 250, 205],
	"lightblue": [173, 216, 230],
	"lightcoral": [240, 128, 128],
	"lightcyan": [224, 255, 255],
	"lightgoldenrodyellow": [250, 250, 210],
	"lightgray": [211, 211, 211],
	"lightgreen": [144, 238, 144],
	"lightgrey": [211, 211, 211],
	"lightpink": [255, 182, 193],
	"lightsalmon": [255, 160, 122],
	"lightseagreen": [32, 178, 170],
	"lightskyblue": [135, 206, 250],
	"lightslategray": [119, 136, 153],
	"lightslategrey": [119, 136, 153],
	"lightsteelblue": [176, 196, 222],
	"lightyellow": [255, 255, 224],
	"lime": [0, 255, 0],
	"limegreen": [50, 205, 50],
	"linen": [250, 240, 230],
	"magenta": [255, 0, 255],
	"maroon": [128, 0, 0],
	"mediumaquamarine": [102, 205, 170],
	"mediumblue": [0, 0, 205],
	"mediumorchid": [186, 85, 211],
	"mediumpurple": [147, 112, 219],
	"mediumseagreen": [60, 179, 113],
	"mediumslateblue": [123, 104, 238],
	"mediumspringgreen": [0, 250, 154],
	"mediumturquoise": [72, 209, 204],
	"mediumvioletred": [199, 21, 133],
	"midnightblue": [25, 25, 112],
	"mintcream": [245, 255, 250],
	"mistyrose": [255, 228, 225],
	"moccasin": [255, 228, 181],
	"navajowhite": [255, 222, 173],
	"navy": [0, 0, 128],
	"oldlace": [253, 245, 230],
	"olive": [128, 128, 0],
	"olivedrab": [107, 142, 35],
	"orange": [255, 165, 0],
	"orangered": [255, 69, 0],
	"orchid": [218, 112, 214],
	"palegoldenrod": [238, 232, 170],
	"palegreen": [152, 251, 152],
	"paleturquoise": [175, 238, 238],
	"palevioletred": [219, 112, 147],
	"papayawhip": [255, 239, 213],
	"peachpuff": [255, 218, 185],
	"peru": [205, 133, 63],
	"pink": [255, 192, 203],
	"plum": [221, 160, 221],
	"powderblue": [176, 224, 230],
	"purple": [128, 0, 128],
	"rebeccapurple": [102, 51, 153],
	"red": [255, 0, 0],
	"rosybrown": [188, 143, 143],
	"royalblue": [65, 105, 225],
	"saddlebrown": [139, 69, 19],
	"salmon": [250, 128, 114],
	"sandybrown": [244, 164, 96],
	"seagreen": [46, 139, 87],
	"seashell": [255, 245, 238],
	"sienna": [160, 82, 45],
	"silver": [192, 192, 192],
	"skyblue": [135, 206, 235],
	"slateblue": [106, 90, 205],
	"slategray": [112, 128, 144],
	"slategrey": [112, 128, 144],
	"snow": [255, 250, 250],
	"springgreen": [0, 255, 127],
	"steelblue": [70, 130, 180],
	"tan": [210, 180, 140],
	"teal": [0, 128, 128],
	"thistle": [216, 191, 216],
	"tomato": [255, 99, 71],
	"turquoise": [64, 224, 208],
	"violet": [238, 130, 238],
	"wheat": [245, 222, 179],
	"white": [255, 255, 255],
	"whitesmoke": [245, 245, 245],
	"yellow": [255, 255, 0],
	"yellowgreen": [154, 205, 50]
};


/***/ }),

/***/ 872:
/***/ ((module) => {



module.exports = function () {
  // https://mths.be/emoji
  return /\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62(?:\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67|\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74|\uDB40\uDC77\uDB40\uDC6C\uDB40\uDC73)\uDB40\uDC7F|\uD83D\uDC68(?:\uD83C\uDFFC\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFB|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFF\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFE])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFE\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFD])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFD\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFC])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83D\uDC68|(?:\uD83D[\uDC68\uDC69])\u200D(?:\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67]))|\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67])|(?:\uD83D[\uDC68\uDC69])\u200D(?:\uD83D[\uDC66\uDC67])|[\u2695\u2696\u2708]\uFE0F|\uD83D[\uDC66\uDC67]|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|(?:\uD83C\uDFFB\u200D[\u2695\u2696\u2708]|\uD83C\uDFFF\u200D[\u2695\u2696\u2708]|\uD83C\uDFFE\u200D[\u2695\u2696\u2708]|\uD83C\uDFFD\u200D[\u2695\u2696\u2708]|\uD83C\uDFFC\u200D[\u2695\u2696\u2708])\uFE0F|\uD83C\uDFFB\u200D(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C[\uDFFB-\uDFFF])|(?:\uD83E\uDDD1\uD83C\uDFFB\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D\uD83D\uDC69)\uD83C\uDFFB|\uD83E\uDDD1(?:\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1(?:\uD83C[\uDFFB-\uDFFF])|\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1)|(?:\uD83E\uDDD1\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D(?:\uD83D[\uDC68\uDC69]))(?:\uD83C[\uDFFB-\uDFFE])|(?:\uD83E\uDDD1\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D\uD83D\uDC69)(?:\uD83C[\uDFFB\uDFFC])|\uD83D\uDC69(?:\uD83C\uDFFE\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFD\uDFFF])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFC\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFD-\uDFFF])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFB\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFC-\uDFFF])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFD\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D(?:\uD83D[\uDC68\uDC69])|\uD83D[\uDC68\uDC69])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFF\u200D(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD]))|\uD83D\uDC69\u200D\uD83D\uDC69\u200D(?:\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67]))|(?:\uD83E\uDDD1\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D\uD83D\uDC69)(?:\uD83C[\uDFFB-\uDFFD])|\uD83D\uDC69\u200D\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC69\u200D\uD83D\uDC69\u200D(?:\uD83D[\uDC66\uDC67])|(?:\uD83D\uDC41\uFE0F\u200D\uD83D\uDDE8|\uD83D\uDC69(?:\uD83C\uDFFF\u200D[\u2695\u2696\u2708]|\uD83C\uDFFE\u200D[\u2695\u2696\u2708]|\uD83C\uDFFC\u200D[\u2695\u2696\u2708]|\uD83C\uDFFB\u200D[\u2695\u2696\u2708]|\uD83C\uDFFD\u200D[\u2695\u2696\u2708]|\u200D[\u2695\u2696\u2708])|(?:(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)\uFE0F|\uD83D\uDC6F|\uD83E[\uDD3C\uDDDE\uDDDF])\u200D[\u2640\u2642]|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)(?:\uD83C[\uDFFB-\uDFFF])\u200D[\u2640\u2642]|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD6-\uDDDD])(?:(?:\uD83C[\uDFFB-\uDFFF])\u200D[\u2640\u2642]|\u200D[\u2640\u2642])|\uD83C\uDFF4\u200D\u2620)\uFE0F|\uD83D\uDC69\u200D\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67])|\uD83C\uDFF3\uFE0F\u200D\uD83C\uDF08|\uD83D\uDC15\u200D\uD83E\uDDBA|\uD83D\uDC69\u200D\uD83D\uDC66|\uD83D\uDC69\u200D\uD83D\uDC67|\uD83C\uDDFD\uD83C\uDDF0|\uD83C\uDDF4\uD83C\uDDF2|\uD83C\uDDF6\uD83C\uDDE6|[#\*0-9]\uFE0F\u20E3|\uD83C\uDDE7(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEF\uDDF1-\uDDF4\uDDF6-\uDDF9\uDDFB\uDDFC\uDDFE\uDDFF])|\uD83C\uDDF9(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDED\uDDEF-\uDDF4\uDDF7\uDDF9\uDDFB\uDDFC\uDDFF])|\uD83C\uDDEA(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDED\uDDF7-\uDDFA])|\uD83E\uDDD1(?:\uD83C[\uDFFB-\uDFFF])|\uD83C\uDDF7(?:\uD83C[\uDDEA\uDDF4\uDDF8\uDDFA\uDDFC])|\uD83D\uDC69(?:\uD83C[\uDFFB-\uDFFF])|\uD83C\uDDF2(?:\uD83C[\uDDE6\uDDE8-\uDDED\uDDF0-\uDDFF])|\uD83C\uDDE6(?:\uD83C[\uDDE8-\uDDEC\uDDEE\uDDF1\uDDF2\uDDF4\uDDF6-\uDDFA\uDDFC\uDDFD\uDDFF])|\uD83C\uDDF0(?:\uD83C[\uDDEA\uDDEC-\uDDEE\uDDF2\uDDF3\uDDF5\uDDF7\uDDFC\uDDFE\uDDFF])|\uD83C\uDDED(?:\uD83C[\uDDF0\uDDF2\uDDF3\uDDF7\uDDF9\uDDFA])|\uD83C\uDDE9(?:\uD83C[\uDDEA\uDDEC\uDDEF\uDDF0\uDDF2\uDDF4\uDDFF])|\uD83C\uDDFE(?:\uD83C[\uDDEA\uDDF9])|\uD83C\uDDEC(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEE\uDDF1-\uDDF3\uDDF5-\uDDFA\uDDFC\uDDFE])|\uD83C\uDDF8(?:\uD83C[\uDDE6-\uDDEA\uDDEC-\uDDF4\uDDF7-\uDDF9\uDDFB\uDDFD-\uDDFF])|\uD83C\uDDEB(?:\uD83C[\uDDEE-\uDDF0\uDDF2\uDDF4\uDDF7])|\uD83C\uDDF5(?:\uD83C[\uDDE6\uDDEA-\uDDED\uDDF0-\uDDF3\uDDF7-\uDDF9\uDDFC\uDDFE])|\uD83C\uDDFB(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDEE\uDDF3\uDDFA])|\uD83C\uDDF3(?:\uD83C[\uDDE6\uDDE8\uDDEA-\uDDEC\uDDEE\uDDF1\uDDF4\uDDF5\uDDF7\uDDFA\uDDFF])|\uD83C\uDDE8(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDEE\uDDF0-\uDDF5\uDDF7\uDDFA-\uDDFF])|\uD83C\uDDF1(?:\uD83C[\uDDE6-\uDDE8\uDDEE\uDDF0\uDDF7-\uDDFB\uDDFE])|\uD83C\uDDFF(?:\uD83C[\uDDE6\uDDF2\uDDFC])|\uD83C\uDDFC(?:\uD83C[\uDDEB\uDDF8])|\uD83C\uDDFA(?:\uD83C[\uDDE6\uDDEC\uDDF2\uDDF3\uDDF8\uDDFE\uDDFF])|\uD83C\uDDEE(?:\uD83C[\uDDE8-\uDDEA\uDDF1-\uDDF4\uDDF6-\uDDF9])|\uD83C\uDDEF(?:\uD83C[\uDDEA\uDDF2\uDDF4\uDDF5])|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD6-\uDDDD])(?:\uD83C[\uDFFB-\uDFFF])|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)(?:\uD83C[\uDFFB-\uDFFF])|(?:[\u261D\u270A-\u270D]|\uD83C[\uDF85\uDFC2\uDFC7]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66\uDC67\uDC6B-\uDC6D\uDC70\uDC72\uDC74-\uDC76\uDC78\uDC7C\uDC83\uDC85\uDCAA\uDD74\uDD7A\uDD90\uDD95\uDD96\uDE4C\uDE4F\uDEC0\uDECC]|\uD83E[\uDD0F\uDD18-\uDD1C\uDD1E\uDD1F\uDD30-\uDD36\uDDB5\uDDB6\uDDBB\uDDD2-\uDDD5])(?:\uD83C[\uDFFB-\uDFFF])|(?:[\u231A\u231B\u23E9-\u23EC\u23F0\u23F3\u25FD\u25FE\u2614\u2615\u2648-\u2653\u267F\u2693\u26A1\u26AA\u26AB\u26BD\u26BE\u26C4\u26C5\u26CE\u26D4\u26EA\u26F2\u26F3\u26F5\u26FA\u26FD\u2705\u270A\u270B\u2728\u274C\u274E\u2753-\u2755\u2757\u2795-\u2797\u27B0\u27BF\u2B1B\u2B1C\u2B50\u2B55]|\uD83C[\uDC04\uDCCF\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE1A\uDE2F\uDE32-\uDE36\uDE38-\uDE3A\uDE50\uDE51\uDF00-\uDF20\uDF2D-\uDF35\uDF37-\uDF7C\uDF7E-\uDF93\uDFA0-\uDFCA\uDFCF-\uDFD3\uDFE0-\uDFF0\uDFF4\uDFF8-\uDFFF]|\uD83D[\uDC00-\uDC3E\uDC40\uDC42-\uDCFC\uDCFF-\uDD3D\uDD4B-\uDD4E\uDD50-\uDD67\uDD7A\uDD95\uDD96\uDDA4\uDDFB-\uDE4F\uDE80-\uDEC5\uDECC\uDED0-\uDED2\uDED5\uDEEB\uDEEC\uDEF4-\uDEFA\uDFE0-\uDFEB]|\uD83E[\uDD0D-\uDD3A\uDD3C-\uDD45\uDD47-\uDD71\uDD73-\uDD76\uDD7A-\uDDA2\uDDA5-\uDDAA\uDDAE-\uDDCA\uDDCD-\uDDFF\uDE70-\uDE73\uDE78-\uDE7A\uDE80-\uDE82\uDE90-\uDE95])|(?:[#\*0-9\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23E9-\u23F3\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB-\u25FE\u2600-\u2604\u260E\u2611\u2614\u2615\u2618\u261D\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u2648-\u2653\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u267F\u2692-\u2697\u2699\u269B\u269C\u26A0\u26A1\u26AA\u26AB\u26B0\u26B1\u26BD\u26BE\u26C4\u26C5\u26C8\u26CE\u26CF\u26D1\u26D3\u26D4\u26E9\u26EA\u26F0-\u26F5\u26F7-\u26FA\u26FD\u2702\u2705\u2708-\u270D\u270F\u2712\u2714\u2716\u271D\u2721\u2728\u2733\u2734\u2744\u2747\u274C\u274E\u2753-\u2755\u2757\u2763\u2764\u2795-\u2797\u27A1\u27B0\u27BF\u2934\u2935\u2B05-\u2B07\u2B1B\u2B1C\u2B50\u2B55\u3030\u303D\u3297\u3299]|\uD83C[\uDC04\uDCCF\uDD70\uDD71\uDD7E\uDD7F\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE02\uDE1A\uDE2F\uDE32-\uDE3A\uDE50\uDE51\uDF00-\uDF21\uDF24-\uDF93\uDF96\uDF97\uDF99-\uDF9B\uDF9E-\uDFF0\uDFF3-\uDFF5\uDFF7-\uDFFF]|\uD83D[\uDC00-\uDCFD\uDCFF-\uDD3D\uDD49-\uDD4E\uDD50-\uDD67\uDD6F\uDD70\uDD73-\uDD7A\uDD87\uDD8A-\uDD8D\uDD90\uDD95\uDD96\uDDA4\uDDA5\uDDA8\uDDB1\uDDB2\uDDBC\uDDC2-\uDDC4\uDDD1-\uDDD3\uDDDC-\uDDDE\uDDE1\uDDE3\uDDE8\uDDEF\uDDF3\uDDFA-\uDE4F\uDE80-\uDEC5\uDECB-\uDED2\uDED5\uDEE0-\uDEE5\uDEE9\uDEEB\uDEEC\uDEF0\uDEF3-\uDEFA\uDFE0-\uDFEB]|\uD83E[\uDD0D-\uDD3A\uDD3C-\uDD45\uDD47-\uDD71\uDD73-\uDD76\uDD7A-\uDDA2\uDDA5-\uDDAA\uDDAE-\uDDCA\uDDCD-\uDDFF\uDE70-\uDE73\uDE78-\uDE7A\uDE80-\uDE82\uDE90-\uDE95])\uFE0F|(?:[\u261D\u26F9\u270A-\u270D]|\uD83C[\uDF85\uDFC2-\uDFC4\uDFC7\uDFCA-\uDFCC]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66-\uDC78\uDC7C\uDC81-\uDC83\uDC85-\uDC87\uDC8F\uDC91\uDCAA\uDD74\uDD75\uDD7A\uDD90\uDD95\uDD96\uDE45-\uDE47\uDE4B-\uDE4F\uDEA3\uDEB4-\uDEB6\uDEC0\uDECC]|\uD83E[\uDD0F\uDD18-\uDD1F\uDD26\uDD30-\uDD39\uDD3C-\uDD3E\uDDB5\uDDB6\uDDB8\uDDB9\uDDBB\uDDCD-\uDDCF\uDDD1-\uDDDD])/g;
};


/***/ }),

/***/ 3430:
/***/ ((module) => {



// do not edit .js files directly - edit src/index.jst



module.exports = function equal(a, b) {
  if (a === b) return true;

  if (a && b && typeof a == 'object' && typeof b == 'object') {
    if (a.constructor !== b.constructor) return false;

    var length, i, keys;
    if (Array.isArray(a)) {
      length = a.length;
      if (length != b.length) return false;
      for (i = length; i-- !== 0;)
        if (!equal(a[i], b[i])) return false;
      return true;
    }



    if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
    if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
    if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();

    keys = Object.keys(a);
    length = keys.length;
    if (length !== Object.keys(b).length) return false;

    for (i = length; i-- !== 0;)
      if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;

    for (i = length; i-- !== 0;) {
      var key = keys[i];

      if (!equal(a[key], b[key])) return false;
    }

    return true;
  }

  // true if both NaN, false otherwise
  return a!==a && b!==b;
};


/***/ }),

/***/ 4519:
/***/ ((module) => {

/* eslint-disable yoda */


const isFullwidthCodePoint = codePoint => {
	if (Number.isNaN(codePoint)) {
		return false;
	}

	// Code points are derived from:
	// http://www.unix.org/Public/UNIDATA/EastAsianWidth.txt
	if (
		codePoint >= 0x1100 && (
			codePoint <= 0x115F || // Hangul Jamo
			codePoint === 0x2329 || // LEFT-POINTING ANGLE BRACKET
			codePoint === 0x232A || // RIGHT-POINTING ANGLE BRACKET
			// CJK Radicals Supplement .. Enclosed CJK Letters and Months
			(0x2E80 <= codePoint && codePoint <= 0x3247 && codePoint !== 0x303F) ||
			// Enclosed CJK Letters and Months .. CJK Unified Ideographs Extension A
			(0x3250 <= codePoint && codePoint <= 0x4DBF) ||
			// CJK Unified Ideographs .. Yi Radicals
			(0x4E00 <= codePoint && codePoint <= 0xA4C6) ||
			// Hangul Jamo Extended-A
			(0xA960 <= codePoint && codePoint <= 0xA97C) ||
			// Hangul Syllables
			(0xAC00 <= codePoint && codePoint <= 0xD7A3) ||
			// CJK Compatibility Ideographs
			(0xF900 <= codePoint && codePoint <= 0xFAFF) ||
			// Vertical Forms
			(0xFE10 <= codePoint && codePoint <= 0xFE19) ||
			// CJK Compatibility Forms .. Small Form Variants
			(0xFE30 <= codePoint && codePoint <= 0xFE6B) ||
			// Halfwidth and Fullwidth Forms
			(0xFF01 <= codePoint && codePoint <= 0xFF60) ||
			(0xFFE0 <= codePoint && codePoint <= 0xFFE6) ||
			// Kana Supplement
			(0x1B000 <= codePoint && codePoint <= 0x1B001) ||
			// Enclosed Ideographic Supplement
			(0x1F200 <= codePoint && codePoint <= 0x1F251) ||
			// CJK Unified Ideographs Extension B .. Tertiary Ideographic Plane
			(0x20000 <= codePoint && codePoint <= 0x3FFFD)
		)
	) {
		return true;
	}

	return false;
};

module.exports = isFullwidthCodePoint;
module.exports["default"] = isFullwidthCodePoint;


/***/ }),

/***/ 4055:
/***/ ((module, exports, __nccwpck_require__) => {

/* module decorator */ module = __nccwpck_require__.nmd(module);
/**
 * lodash (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright jQuery Foundation and other contributors <https://jquery.org/>
 * Released under MIT license <https://lodash.com/license>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 */

/** Used as default options for `_.truncate`. */
var DEFAULT_TRUNC_LENGTH = 30,
    DEFAULT_TRUNC_OMISSION = '...';

/** Used as references for various `Number` constants. */
var INFINITY = 1 / 0,
    MAX_INTEGER = 1.7976931348623157e+308,
    NAN = 0 / 0;

/** `Object#toString` result references. */
var regexpTag = '[object RegExp]',
    symbolTag = '[object Symbol]';

/** Used to match leading and trailing whitespace. */
var reTrim = /^\s+|\s+$/g;

/** Used to match `RegExp` flags from their coerced string values. */
var reFlags = /\w*$/;

/** Used to detect bad signed hexadecimal string values. */
var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;

/** Used to detect binary string values. */
var reIsBinary = /^0b[01]+$/i;

/** Used to detect octal string values. */
var reIsOctal = /^0o[0-7]+$/i;

/** Used to compose unicode character classes. */
var rsAstralRange = '\\ud800-\\udfff',
    rsComboMarksRange = '\\u0300-\\u036f\\ufe20-\\ufe23',
    rsComboSymbolsRange = '\\u20d0-\\u20f0',
    rsVarRange = '\\ufe0e\\ufe0f';

/** Used to compose unicode capture groups. */
var rsAstral = '[' + rsAstralRange + ']',
    rsCombo = '[' + rsComboMarksRange + rsComboSymbolsRange + ']',
    rsFitz = '\\ud83c[\\udffb-\\udfff]',
    rsModifier = '(?:' + rsCombo + '|' + rsFitz + ')',
    rsNonAstral = '[^' + rsAstralRange + ']',
    rsRegional = '(?:\\ud83c[\\udde6-\\uddff]){2}',
    rsSurrPair = '[\\ud800-\\udbff][\\udc00-\\udfff]',
    rsZWJ = '\\u200d';

/** Used to compose unicode regexes. */
var reOptMod = rsModifier + '?',
    rsOptVar = '[' + rsVarRange + ']?',
    rsOptJoin = '(?:' + rsZWJ + '(?:' + [rsNonAstral, rsRegional, rsSurrPair].join('|') + ')' + rsOptVar + reOptMod + ')*',
    rsSeq = rsOptVar + reOptMod + rsOptJoin,
    rsSymbol = '(?:' + [rsNonAstral + rsCombo + '?', rsCombo, rsRegional, rsSurrPair, rsAstral].join('|') + ')';

/** Used to match [string symbols](https://mathiasbynens.be/notes/javascript-unicode). */
var reUnicode = RegExp(rsFitz + '(?=' + rsFitz + ')|' + rsSymbol + rsSeq, 'g');

/** Used to detect strings with [zero-width joiners or code points from the astral planes](http://eev.ee/blog/2015/09/12/dark-corners-of-unicode/). */
var reHasUnicode = RegExp('[' + rsZWJ + rsAstralRange  + rsComboMarksRange + rsComboSymbolsRange + rsVarRange + ']');

/** Built-in method references without a dependency on `root`. */
var freeParseInt = parseInt;

/** Detect free variable `global` from Node.js. */
var freeGlobal = typeof global == 'object' && global && global.Object === Object && global;

/** Detect free variable `self`. */
var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

/** Used as a reference to the global object. */
var root = freeGlobal || freeSelf || Function('return this')();

/** Detect free variable `exports`. */
var freeExports =  true && exports && !exports.nodeType && exports;

/** Detect free variable `module`. */
var freeModule = freeExports && "object" == 'object' && module && !module.nodeType && module;

/** Detect the popular CommonJS extension `module.exports`. */
var moduleExports = freeModule && freeModule.exports === freeExports;

/** Detect free variable `process` from Node.js. */
var freeProcess = moduleExports && freeGlobal.process;

/** Used to access faster Node.js helpers. */
var nodeUtil = (function() {
  try {
    return freeProcess && freeProcess.binding('util');
  } catch (e) {}
}());

/* Node.js helper references. */
var nodeIsRegExp = nodeUtil && nodeUtil.isRegExp;

/**
 * Gets the size of an ASCII `string`.
 *
 * @private
 * @param {string} string The string inspect.
 * @returns {number} Returns the string size.
 */
var asciiSize = baseProperty('length');

/**
 * Converts an ASCII `string` to an array.
 *
 * @private
 * @param {string} string The string to convert.
 * @returns {Array} Returns the converted array.
 */
function asciiToArray(string) {
  return string.split('');
}

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new accessor function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * The base implementation of `_.unary` without support for storing metadata.
 *
 * @private
 * @param {Function} func The function to cap arguments for.
 * @returns {Function} Returns the new capped function.
 */
function baseUnary(func) {
  return function(value) {
    return func(value);
  };
}

/**
 * Checks if `string` contains Unicode symbols.
 *
 * @private
 * @param {string} string The string to inspect.
 * @returns {boolean} Returns `true` if a symbol is found, else `false`.
 */
function hasUnicode(string) {
  return reHasUnicode.test(string);
}

/**
 * Gets the number of symbols in `string`.
 *
 * @private
 * @param {string} string The string to inspect.
 * @returns {number} Returns the string size.
 */
function stringSize(string) {
  return hasUnicode(string)
    ? unicodeSize(string)
    : asciiSize(string);
}

/**
 * Converts `string` to an array.
 *
 * @private
 * @param {string} string The string to convert.
 * @returns {Array} Returns the converted array.
 */
function stringToArray(string) {
  return hasUnicode(string)
    ? unicodeToArray(string)
    : asciiToArray(string);
}

/**
 * Gets the size of a Unicode `string`.
 *
 * @private
 * @param {string} string The string inspect.
 * @returns {number} Returns the string size.
 */
function unicodeSize(string) {
  var result = reUnicode.lastIndex = 0;
  while (reUnicode.test(string)) {
    result++;
  }
  return result;
}

/**
 * Converts a Unicode `string` to an array.
 *
 * @private
 * @param {string} string The string to convert.
 * @returns {Array} Returns the converted array.
 */
function unicodeToArray(string) {
  return string.match(reUnicode) || [];
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Built-in value references. */
var Symbol = root.Symbol;

/** Used to convert symbols to primitives and strings. */
var symbolProto = Symbol ? Symbol.prototype : undefined,
    symbolToString = symbolProto ? symbolProto.toString : undefined;

/**
 * The base implementation of `_.isRegExp` without Node.js optimizations.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a regexp, else `false`.
 */
function baseIsRegExp(value) {
  return isObject(value) && objectToString.call(value) == regexpTag;
}

/**
 * The base implementation of `_.slice` without an iteratee call guard.
 *
 * @private
 * @param {Array} array The array to slice.
 * @param {number} [start=0] The start position.
 * @param {number} [end=array.length] The end position.
 * @returns {Array} Returns the slice of `array`.
 */
function baseSlice(array, start, end) {
  var index = -1,
      length = array.length;

  if (start < 0) {
    start = -start > length ? 0 : (length + start);
  }
  end = end > length ? length : end;
  if (end < 0) {
    end += length;
  }
  length = start > end ? 0 : ((end - start) >>> 0);
  start >>>= 0;

  var result = Array(length);
  while (++index < length) {
    result[index] = array[index + start];
  }
  return result;
}

/**
 * The base implementation of `_.toString` which doesn't convert nullish
 * values to empty strings.
 *
 * @private
 * @param {*} value The value to process.
 * @returns {string} Returns the string.
 */
function baseToString(value) {
  // Exit early for strings to avoid a performance hit in some environments.
  if (typeof value == 'string') {
    return value;
  }
  if (isSymbol(value)) {
    return symbolToString ? symbolToString.call(value) : '';
  }
  var result = (value + '');
  return (result == '0' && (1 / value) == -INFINITY) ? '-0' : result;
}

/**
 * Casts `array` to a slice if it's needed.
 *
 * @private
 * @param {Array} array The array to inspect.
 * @param {number} start The start position.
 * @param {number} [end=array.length] The end position.
 * @returns {Array} Returns the cast slice.
 */
function castSlice(array, start, end) {
  var length = array.length;
  end = end === undefined ? length : end;
  return (!start && end >= length) ? array : baseSlice(array, start, end);
}

/**
 * Checks if `value` is the
 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is classified as a `RegExp` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a regexp, else `false`.
 * @example
 *
 * _.isRegExp(/abc/);
 * // => true
 *
 * _.isRegExp('/abc/');
 * // => false
 */
var isRegExp = nodeIsRegExp ? baseUnary(nodeIsRegExp) : baseIsRegExp;

/**
 * Checks if `value` is classified as a `Symbol` primitive or object.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
 * @example
 *
 * _.isSymbol(Symbol.iterator);
 * // => true
 *
 * _.isSymbol('abc');
 * // => false
 */
function isSymbol(value) {
  return typeof value == 'symbol' ||
    (isObjectLike(value) && objectToString.call(value) == symbolTag);
}

/**
 * Converts `value` to a finite number.
 *
 * @static
 * @memberOf _
 * @since 4.12.0
 * @category Lang
 * @param {*} value The value to convert.
 * @returns {number} Returns the converted number.
 * @example
 *
 * _.toFinite(3.2);
 * // => 3.2
 *
 * _.toFinite(Number.MIN_VALUE);
 * // => 5e-324
 *
 * _.toFinite(Infinity);
 * // => 1.7976931348623157e+308
 *
 * _.toFinite('3.2');
 * // => 3.2
 */
function toFinite(value) {
  if (!value) {
    return value === 0 ? value : 0;
  }
  value = toNumber(value);
  if (value === INFINITY || value === -INFINITY) {
    var sign = (value < 0 ? -1 : 1);
    return sign * MAX_INTEGER;
  }
  return value === value ? value : 0;
}

/**
 * Converts `value` to an integer.
 *
 * **Note:** This method is loosely based on
 * [`ToInteger`](http://www.ecma-international.org/ecma-262/7.0/#sec-tointeger).
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to convert.
 * @returns {number} Returns the converted integer.
 * @example
 *
 * _.toInteger(3.2);
 * // => 3
 *
 * _.toInteger(Number.MIN_VALUE);
 * // => 0
 *
 * _.toInteger(Infinity);
 * // => 1.7976931348623157e+308
 *
 * _.toInteger('3.2');
 * // => 3
 */
function toInteger(value) {
  var result = toFinite(value),
      remainder = result % 1;

  return result === result ? (remainder ? result - remainder : result) : 0;
}

/**
 * Converts `value` to a number.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to process.
 * @returns {number} Returns the number.
 * @example
 *
 * _.toNumber(3.2);
 * // => 3.2
 *
 * _.toNumber(Number.MIN_VALUE);
 * // => 5e-324
 *
 * _.toNumber(Infinity);
 * // => Infinity
 *
 * _.toNumber('3.2');
 * // => 3.2
 */
function toNumber(value) {
  if (typeof value == 'number') {
    return value;
  }
  if (isSymbol(value)) {
    return NAN;
  }
  if (isObject(value)) {
    var other = typeof value.valueOf == 'function' ? value.valueOf() : value;
    value = isObject(other) ? (other + '') : other;
  }
  if (typeof value != 'string') {
    return value === 0 ? value : +value;
  }
  value = value.replace(reTrim, '');
  var isBinary = reIsBinary.test(value);
  return (isBinary || reIsOctal.test(value))
    ? freeParseInt(value.slice(2), isBinary ? 2 : 8)
    : (reIsBadHex.test(value) ? NAN : +value);
}

/**
 * Converts `value` to a string. An empty string is returned for `null`
 * and `undefined` values. The sign of `-0` is preserved.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to process.
 * @returns {string} Returns the string.
 * @example
 *
 * _.toString(null);
 * // => ''
 *
 * _.toString(-0);
 * // => '-0'
 *
 * _.toString([1, 2, 3]);
 * // => '1,2,3'
 */
function toString(value) {
  return value == null ? '' : baseToString(value);
}

/**
 * Truncates `string` if it's longer than the given maximum string length.
 * The last characters of the truncated string are replaced with the omission
 * string which defaults to "...".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category String
 * @param {string} [string=''] The string to truncate.
 * @param {Object} [options={}] The options object.
 * @param {number} [options.length=30] The maximum string length.
 * @param {string} [options.omission='...'] The string to indicate text is omitted.
 * @param {RegExp|string} [options.separator] The separator pattern to truncate to.
 * @returns {string} Returns the truncated string.
 * @example
 *
 * _.truncate('hi-diddly-ho there, neighborino');
 * // => 'hi-diddly-ho there, neighbo...'
 *
 * _.truncate('hi-diddly-ho there, neighborino', {
 *   'length': 24,
 *   'separator': ' '
 * });
 * // => 'hi-diddly-ho there,...'
 *
 * _.truncate('hi-diddly-ho there, neighborino', {
 *   'length': 24,
 *   'separator': /,? +/
 * });
 * // => 'hi-diddly-ho there...'
 *
 * _.truncate('hi-diddly-ho there, neighborino', {
 *   'omission': ' [...]'
 * });
 * // => 'hi-diddly-ho there, neig [...]'
 */
function truncate(string, options) {
  var length = DEFAULT_TRUNC_LENGTH,
      omission = DEFAULT_TRUNC_OMISSION;

  if (isObject(options)) {
    var separator = 'separator' in options ? options.separator : separator;
    length = 'length' in options ? toInteger(options.length) : length;
    omission = 'omission' in options ? baseToString(options.omission) : omission;
  }
  string = toString(string);

  var strLength = string.length;
  if (hasUnicode(string)) {
    var strSymbols = stringToArray(string);
    strLength = strSymbols.length;
  }
  if (length >= strLength) {
    return string;
  }
  var end = length - stringSize(omission);
  if (end < 1) {
    return omission;
  }
  var result = strSymbols
    ? castSlice(strSymbols, 0, end).join('')
    : string.slice(0, end);

  if (separator === undefined) {
    return result + omission;
  }
  if (strSymbols) {
    end += (result.length - end);
  }
  if (isRegExp(separator)) {
    if (string.slice(end).search(separator)) {
      var match,
          substring = result;

      if (!separator.global) {
        separator = RegExp(separator.source, toString(reFlags.exec(separator)) + 'g');
      }
      separator.lastIndex = 0;
      while ((match = separator.exec(substring))) {
        var newEnd = match.index;
      }
      result = result.slice(0, newEnd === undefined ? end : newEnd);
    }
  } else if (string.indexOf(baseToString(separator), end) != end) {
    var index = result.lastIndexOf(separator);
    if (index > -1) {
      result = result.slice(0, index);
    }
  }
  return result + omission;
}

module.exports = truncate;


/***/ }),

/***/ 3298:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {


const isFullwidthCodePoint = __nccwpck_require__(4519);
const astralRegex = __nccwpck_require__(8493);
const ansiStyles = __nccwpck_require__(4412);

const ESCAPES = [
	'\u001B',
	'\u009B'
];

const wrapAnsi = code => `${ESCAPES[0]}[${code}m`;

const checkAnsi = (ansiCodes, isEscapes, endAnsiCode) => {
	let output = [];
	ansiCodes = [...ansiCodes];

	for (let ansiCode of ansiCodes) {
		const ansiCodeOrigin = ansiCode;
		if (ansiCode.includes(';')) {
			ansiCode = ansiCode.split(';')[0][0] + '0';
		}

		const item = ansiStyles.codes.get(Number.parseInt(ansiCode, 10));
		if (item) {
			const indexEscape = ansiCodes.indexOf(item.toString());
			if (indexEscape === -1) {
				output.push(wrapAnsi(isEscapes ? item : ansiCodeOrigin));
			} else {
				ansiCodes.splice(indexEscape, 1);
			}
		} else if (isEscapes) {
			output.push(wrapAnsi(0));
			break;
		} else {
			output.push(wrapAnsi(ansiCodeOrigin));
		}
	}

	if (isEscapes) {
		output = output.filter((element, index) => output.indexOf(element) === index);

		if (endAnsiCode !== undefined) {
			const fistEscapeCode = wrapAnsi(ansiStyles.codes.get(Number.parseInt(endAnsiCode, 10)));
			output = output.reduce((current, next) => next === fistEscapeCode ? [next, ...current] : [...current, next], []);
		}
	}

	return output.join('');
};

module.exports = (string, begin, end) => {
	const characters = [...string];
	const ansiCodes = [];

	let stringEnd = typeof end === 'number' ? end : characters.length;
	let isInsideEscape = false;
	let ansiCode;
	let visible = 0;
	let output = '';

	for (const [index, character] of characters.entries()) {
		let leftEscape = false;

		if (ESCAPES.includes(character)) {
			const code = /\d[^m]*/.exec(string.slice(index, index + 18));
			ansiCode = code && code.length > 0 ? code[0] : undefined;

			if (visible < stringEnd) {
				isInsideEscape = true;

				if (ansiCode !== undefined) {
					ansiCodes.push(ansiCode);
				}
			}
		} else if (isInsideEscape && character === 'm') {
			isInsideEscape = false;
			leftEscape = true;
		}

		if (!isInsideEscape && !leftEscape) {
			visible++;
		}

		if (!astralRegex({exact: true}).test(character) && isFullwidthCodePoint(character.codePointAt())) {
			visible++;

			if (typeof end !== 'number') {
				stringEnd++;
			}
		}

		if (visible > begin && visible <= stringEnd) {
			output += character;
		} else if (visible === begin && !isInsideEscape && ansiCode !== undefined) {
			output = checkAnsi(ansiCodes);
		} else if (visible >= stringEnd) {
			output += checkAnsi(ansiCodes, true, ansiCode);
			break;
		}
	}

	return output;
};


/***/ }),

/***/ 3958:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {


const ansiRegex = __nccwpck_require__(21);

module.exports = string => typeof string === 'string' ? string.replace(ansiRegex(), '') : string;


/***/ }),

/***/ 2651:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.alignVerticalRangeContent = exports.wrapRangeContent = void 0;
const string_width_1 = __importDefault(__nccwpck_require__(7492));
const alignString_1 = __nccwpck_require__(7428);
const mapDataUsingRowHeights_1 = __nccwpck_require__(8188);
const padTableData_1 = __nccwpck_require__(8649);
const truncateTableData_1 = __nccwpck_require__(4042);
const utils_1 = __nccwpck_require__(1497);
const wrapCell_1 = __nccwpck_require__(8966);
/**
 * Fill content into all cells in range in order to calculate total height
 */
const wrapRangeContent = (rangeConfig, rangeWidth, context) => {
    const { topLeft, paddingRight, paddingLeft, truncate, wrapWord, alignment } = rangeConfig;
    const originalContent = context.rows[topLeft.row][topLeft.col];
    const contentWidth = rangeWidth - paddingLeft - paddingRight;
    return (0, wrapCell_1.wrapCell)((0, truncateTableData_1.truncateString)(originalContent, truncate), contentWidth, wrapWord).map((line) => {
        const alignedLine = (0, alignString_1.alignString)(line, contentWidth, alignment);
        return (0, padTableData_1.padString)(alignedLine, paddingLeft, paddingRight);
    });
};
exports.wrapRangeContent = wrapRangeContent;
const alignVerticalRangeContent = (range, content, context) => {
    const { rows, drawHorizontalLine, rowHeights } = context;
    const { topLeft, bottomRight, verticalAlignment } = range;
    // They are empty before calculateRowHeights function run
    if (rowHeights.length === 0) {
        return [];
    }
    const totalCellHeight = (0, utils_1.sumArray)(rowHeights.slice(topLeft.row, bottomRight.row + 1));
    const totalBorderHeight = bottomRight.row - topLeft.row;
    const hiddenHorizontalBorderCount = (0, utils_1.sequence)(topLeft.row + 1, bottomRight.row).filter((horizontalBorderIndex) => {
        return !drawHorizontalLine(horizontalBorderIndex, rows.length);
    }).length;
    const availableRangeHeight = totalCellHeight + totalBorderHeight - hiddenHorizontalBorderCount;
    return (0, mapDataUsingRowHeights_1.padCellVertically)(content, availableRangeHeight, verticalAlignment).map((line) => {
        if (line.length === 0) {
            return ' '.repeat((0, string_width_1.default)(content[0]));
        }
        return line;
    });
};
exports.alignVerticalRangeContent = alignVerticalRangeContent;
//# sourceMappingURL=alignSpanningCell.js.map

/***/ }),

/***/ 7428:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.alignString = void 0;
const string_width_1 = __importDefault(__nccwpck_require__(7492));
const utils_1 = __nccwpck_require__(1497);
const alignLeft = (subject, width) => {
    return subject + ' '.repeat(width);
};
const alignRight = (subject, width) => {
    return ' '.repeat(width) + subject;
};
const alignCenter = (subject, width) => {
    return ' '.repeat(Math.floor(width / 2)) + subject + ' '.repeat(Math.ceil(width / 2));
};
const alignJustify = (subject, width) => {
    const spaceSequenceCount = (0, utils_1.countSpaceSequence)(subject);
    if (spaceSequenceCount === 0) {
        return alignLeft(subject, width);
    }
    const addingSpaces = (0, utils_1.distributeUnevenly)(width, spaceSequenceCount);
    if (Math.max(...addingSpaces) > 3) {
        return alignLeft(subject, width);
    }
    let spaceSequenceIndex = 0;
    return subject.replace(/\s+/g, (groupSpace) => {
        return groupSpace + ' '.repeat(addingSpaces[spaceSequenceIndex++]);
    });
};
/**
 * Pads a string to the left and/or right to position the subject
 * text in a desired alignment within a container.
 */
const alignString = (subject, containerWidth, alignment) => {
    const subjectWidth = (0, string_width_1.default)(subject);
    if (subjectWidth === containerWidth) {
        return subject;
    }
    if (subjectWidth > containerWidth) {
        throw new Error('Subject parameter value width cannot be greater than the container width.');
    }
    if (subjectWidth === 0) {
        return ' '.repeat(containerWidth);
    }
    const availableWidth = containerWidth - subjectWidth;
    if (alignment === 'left') {
        return alignLeft(subject, availableWidth);
    }
    if (alignment === 'right') {
        return alignRight(subject, availableWidth);
    }
    if (alignment === 'justify') {
        return alignJustify(subject, availableWidth);
    }
    return alignCenter(subject, availableWidth);
};
exports.alignString = alignString;
//# sourceMappingURL=alignString.js.map

/***/ }),

/***/ 7061:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.alignTableData = void 0;
const alignString_1 = __nccwpck_require__(7428);
const alignTableData = (rows, config) => {
    return rows.map((row, rowIndex) => {
        return row.map((cell, cellIndex) => {
            var _a;
            const { width, alignment } = config.columns[cellIndex];
            const containingRange = (_a = config.spanningCellManager) === null || _a === void 0 ? void 0 : _a.getContainingRange({ col: cellIndex,
                row: rowIndex }, { mapped: true });
            if (containingRange) {
                return cell;
            }
            return (0, alignString_1.alignString)(cell, width, alignment);
        });
    });
};
exports.alignTableData = alignTableData;
//# sourceMappingURL=alignTableData.js.map

/***/ }),

/***/ 483:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.calculateCellHeight = void 0;
const wrapCell_1 = __nccwpck_require__(8966);
/**
 * Calculates height of cell content in regard to its width and word wrapping.
 */
const calculateCellHeight = (value, columnWidth, useWrapWord = false) => {
    return (0, wrapCell_1.wrapCell)(value, columnWidth, useWrapWord).length;
};
exports.calculateCellHeight = calculateCellHeight;
//# sourceMappingURL=calculateCellHeight.js.map

/***/ }),

/***/ 67:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.calculateMaximumColumnWidths = exports.calculateMaximumCellWidth = void 0;
const string_width_1 = __importDefault(__nccwpck_require__(7492));
const utils_1 = __nccwpck_require__(1497);
const calculateMaximumCellWidth = (cell) => {
    return Math.max(...cell.split('\n').map(string_width_1.default));
};
exports.calculateMaximumCellWidth = calculateMaximumCellWidth;
/**
 * Produces an array of values that describe the largest value length (width) in every column.
 */
const calculateMaximumColumnWidths = (rows, spanningCellConfigs = []) => {
    const columnWidths = new Array(rows[0].length).fill(0);
    const rangeCoordinates = spanningCellConfigs.map(utils_1.calculateRangeCoordinate);
    const isSpanningCell = (rowIndex, columnIndex) => {
        return rangeCoordinates.some((rangeCoordinate) => {
            return (0, utils_1.isCellInRange)({ col: columnIndex,
                row: rowIndex }, rangeCoordinate);
        });
    };
    rows.forEach((row, rowIndex) => {
        row.forEach((cell, cellIndex) => {
            if (isSpanningCell(rowIndex, cellIndex)) {
                return;
            }
            columnWidths[cellIndex] = Math.max(columnWidths[cellIndex], (0, exports.calculateMaximumCellWidth)(cell));
        });
    });
    return columnWidths;
};
exports.calculateMaximumColumnWidths = calculateMaximumColumnWidths;
//# sourceMappingURL=calculateMaximumColumnWidths.js.map

/***/ }),

/***/ 6246:
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.calculateOutputColumnWidths = void 0;
const calculateOutputColumnWidths = (config) => {
    return config.columns.map((col) => {
        return col.paddingLeft + col.width + col.paddingRight;
    });
};
exports.calculateOutputColumnWidths = calculateOutputColumnWidths;
//# sourceMappingURL=calculateOutputColumnWidths.js.map

/***/ }),

/***/ 2696:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.calculateRowHeights = void 0;
const calculateCellHeight_1 = __nccwpck_require__(483);
const utils_1 = __nccwpck_require__(1497);
/**
 * Produces an array of values that describe the largest value length (height) in every row.
 */
const calculateRowHeights = (rows, config) => {
    const rowHeights = [];
    for (const [rowIndex, row] of rows.entries()) {
        let rowHeight = 1;
        row.forEach((cell, cellIndex) => {
            var _a;
            const containingRange = (_a = config.spanningCellManager) === null || _a === void 0 ? void 0 : _a.getContainingRange({ col: cellIndex,
                row: rowIndex });
            if (!containingRange) {
                const cellHeight = (0, calculateCellHeight_1.calculateCellHeight)(cell, config.columns[cellIndex].width, config.columns[cellIndex].wrapWord);
                rowHeight = Math.max(rowHeight, cellHeight);
                return;
            }
            const { topLeft, bottomRight, height } = containingRange;
            // bottom-most cell of a range needs to contain all remain lines of spanning cells
            if (rowIndex === bottomRight.row) {
                const totalOccupiedSpanningCellHeight = (0, utils_1.sumArray)(rowHeights.slice(topLeft.row));
                const totalHorizontalBorderHeight = bottomRight.row - topLeft.row;
                const totalHiddenHorizontalBorderHeight = (0, utils_1.sequence)(topLeft.row + 1, bottomRight.row).filter((horizontalBorderIndex) => {
                    var _a;
                    /* istanbul ignore next */
                    return !((_a = config.drawHorizontalLine) === null || _a === void 0 ? void 0 : _a.call(config, horizontalBorderIndex, rows.length));
                }).length;
                const cellHeight = height - totalOccupiedSpanningCellHeight - totalHorizontalBorderHeight + totalHiddenHorizontalBorderHeight;
                rowHeight = Math.max(rowHeight, cellHeight);
            }
            // otherwise, just depend on other sibling cell heights in the row
        });
        rowHeights.push(rowHeight);
    }
    return rowHeights;
};
exports.calculateRowHeights = calculateRowHeights;
//# sourceMappingURL=calculateRowHeights.js.map

/***/ }),

/***/ 888:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.calculateSpanningCellWidth = void 0;
const utils_1 = __nccwpck_require__(1497);
const calculateSpanningCellWidth = (rangeConfig, dependencies) => {
    const { columnsConfig, drawVerticalLine } = dependencies;
    const { topLeft, bottomRight } = rangeConfig;
    const totalWidth = (0, utils_1.sumArray)(columnsConfig.slice(topLeft.col, bottomRight.col + 1).map(({ width }) => {
        return width;
    }));
    const totalPadding = topLeft.col === bottomRight.col ?
        columnsConfig[topLeft.col].paddingRight +
            columnsConfig[bottomRight.col].paddingLeft :
        (0, utils_1.sumArray)(columnsConfig
            .slice(topLeft.col, bottomRight.col + 1)
            .map(({ paddingLeft, paddingRight }) => {
            return paddingLeft + paddingRight;
        }));
    const totalBorderWidths = bottomRight.col - topLeft.col;
    const totalHiddenVerticalBorders = (0, utils_1.sequence)(topLeft.col + 1, bottomRight.col).filter((verticalBorderIndex) => {
        return !drawVerticalLine(verticalBorderIndex, columnsConfig.length);
    }).length;
    return totalWidth + totalPadding + totalBorderWidths - totalHiddenVerticalBorders;
};
exports.calculateSpanningCellWidth = calculateSpanningCellWidth;
//# sourceMappingURL=calculateSpanningCellWidth.js.map

/***/ }),

/***/ 6334:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.createStream = void 0;
const alignTableData_1 = __nccwpck_require__(7061);
const calculateRowHeights_1 = __nccwpck_require__(2696);
const drawBorder_1 = __nccwpck_require__(46);
const drawRow_1 = __nccwpck_require__(2698);
const makeStreamConfig_1 = __nccwpck_require__(7366);
const mapDataUsingRowHeights_1 = __nccwpck_require__(8188);
const padTableData_1 = __nccwpck_require__(8649);
const stringifyTableData_1 = __nccwpck_require__(3337);
const truncateTableData_1 = __nccwpck_require__(4042);
const utils_1 = __nccwpck_require__(1497);
const prepareData = (data, config) => {
    let rows = (0, stringifyTableData_1.stringifyTableData)(data);
    rows = (0, truncateTableData_1.truncateTableData)(rows, (0, utils_1.extractTruncates)(config));
    const rowHeights = (0, calculateRowHeights_1.calculateRowHeights)(rows, config);
    rows = (0, mapDataUsingRowHeights_1.mapDataUsingRowHeights)(rows, rowHeights, config);
    rows = (0, alignTableData_1.alignTableData)(rows, config);
    rows = (0, padTableData_1.padTableData)(rows, config);
    return rows;
};
const create = (row, columnWidths, config) => {
    const rows = prepareData([row], config);
    const body = rows.map((literalRow) => {
        return (0, drawRow_1.drawRow)(literalRow, config);
    }).join('');
    let output;
    output = '';
    output += (0, drawBorder_1.drawBorderTop)(columnWidths, config);
    output += body;
    output += (0, drawBorder_1.drawBorderBottom)(columnWidths, config);
    output = output.trimEnd();
    process.stdout.write(output);
};
const append = (row, columnWidths, config) => {
    const rows = prepareData([row], config);
    const body = rows.map((literalRow) => {
        return (0, drawRow_1.drawRow)(literalRow, config);
    }).join('');
    let output = '';
    const bottom = (0, drawBorder_1.drawBorderBottom)(columnWidths, config);
    if (bottom !== '\n') {
        output = '\r\u001B[K';
    }
    output += (0, drawBorder_1.drawBorderJoin)(columnWidths, config);
    output += body;
    output += bottom;
    output = output.trimEnd();
    process.stdout.write(output);
};
const createStream = (userConfig) => {
    const config = (0, makeStreamConfig_1.makeStreamConfig)(userConfig);
    const columnWidths = Object.values(config.columns).map((column) => {
        return column.width + column.paddingLeft + column.paddingRight;
    });
    let empty = true;
    return {
        write: (row) => {
            if (row.length !== config.columnCount) {
                throw new Error('Row cell count does not match the config.columnCount.');
            }
            if (empty) {
                empty = false;
                create(row, columnWidths, config);
            }
            else {
                append(row, columnWidths, config);
            }
        },
    };
};
exports.createStream = createStream;
//# sourceMappingURL=createStream.js.map

/***/ }),

/***/ 46:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.createTableBorderGetter = exports.drawBorderBottom = exports.drawBorderJoin = exports.drawBorderTop = exports.drawBorder = exports.createSeparatorGetter = exports.drawBorderSegments = void 0;
const drawContent_1 = __nccwpck_require__(6499);
const drawBorderSegments = (columnWidths, parameters) => {
    const { separator, horizontalBorderIndex, spanningCellManager } = parameters;
    return columnWidths.map((columnWidth, columnIndex) => {
        const normalSegment = separator.body.repeat(columnWidth);
        if (horizontalBorderIndex === undefined) {
            return normalSegment;
        }
        /* istanbul ignore next */
        const range = spanningCellManager === null || spanningCellManager === void 0 ? void 0 : spanningCellManager.getContainingRange({ col: columnIndex,
            row: horizontalBorderIndex });
        if (!range) {
            return normalSegment;
        }
        const { topLeft } = range;
        // draw border segments as usual for top border of spanning cell
        if (horizontalBorderIndex === topLeft.row) {
            return normalSegment;
        }
        // if for first column/row of spanning cell, just skip
        if (columnIndex !== topLeft.col) {
            return '';
        }
        return range.extractBorderContent(horizontalBorderIndex);
    });
};
exports.drawBorderSegments = drawBorderSegments;
const createSeparatorGetter = (dependencies) => {
    const { separator, spanningCellManager, horizontalBorderIndex, rowCount } = dependencies;
    // eslint-disable-next-line complexity
    return (verticalBorderIndex, columnCount) => {
        const inSameRange = spanningCellManager === null || spanningCellManager === void 0 ? void 0 : spanningCellManager.inSameRange;
        if (horizontalBorderIndex !== undefined && inSameRange) {
            const topCell = { col: verticalBorderIndex,
                row: horizontalBorderIndex - 1 };
            const leftCell = { col: verticalBorderIndex - 1,
                row: horizontalBorderIndex };
            const oppositeCell = { col: verticalBorderIndex - 1,
                row: horizontalBorderIndex - 1 };
            const currentCell = { col: verticalBorderIndex,
                row: horizontalBorderIndex };
            const pairs = [
                [oppositeCell, topCell],
                [topCell, currentCell],
                [currentCell, leftCell],
                [leftCell, oppositeCell],
            ];
            // left side of horizontal border
            if (verticalBorderIndex === 0) {
                if (inSameRange(currentCell, topCell) && separator.bodyJoinOuter) {
                    return separator.bodyJoinOuter;
                }
                return separator.left;
            }
            // right side of horizontal border
            if (verticalBorderIndex === columnCount) {
                if (inSameRange(oppositeCell, leftCell) && separator.bodyJoinOuter) {
                    return separator.bodyJoinOuter;
                }
                return separator.right;
            }
            // top horizontal border
            if (horizontalBorderIndex === 0) {
                if (inSameRange(currentCell, leftCell)) {
                    return separator.body;
                }
                return separator.join;
            }
            // bottom horizontal border
            if (horizontalBorderIndex === rowCount) {
                if (inSameRange(topCell, oppositeCell)) {
                    return separator.body;
                }
                return separator.join;
            }
            const sameRangeCount = pairs.map((pair) => {
                return inSameRange(...pair);
            }).filter(Boolean).length;
            // four cells are belongs to different spanning cells
            if (sameRangeCount === 0) {
                return separator.join;
            }
            // belong to one spanning cell
            if (sameRangeCount === 4) {
                return '';
            }
            // belongs to two spanning cell
            if (sameRangeCount === 2) {
                if (inSameRange(...pairs[1]) && inSameRange(...pairs[3]) && separator.bodyJoinInner) {
                    return separator.bodyJoinInner;
                }
                return separator.body;
            }
            /* istanbul ignore next */
            if (sameRangeCount === 1) {
                if (!separator.joinRight || !separator.joinLeft || !separator.joinUp || !separator.joinDown) {
                    throw new Error(`Can not get border separator for position [${horizontalBorderIndex}, ${verticalBorderIndex}]`);
                }
                if (inSameRange(...pairs[0])) {
                    return separator.joinDown;
                }
                if (inSameRange(...pairs[1])) {
                    return separator.joinLeft;
                }
                if (inSameRange(...pairs[2])) {
                    return separator.joinUp;
                }
                return separator.joinRight;
            }
            /* istanbul ignore next */
            throw new Error('Invalid case');
        }
        if (verticalBorderIndex === 0) {
            return separator.left;
        }
        if (verticalBorderIndex === columnCount) {
            return separator.right;
        }
        return separator.join;
    };
};
exports.createSeparatorGetter = createSeparatorGetter;
const drawBorder = (columnWidths, parameters) => {
    const borderSegments = (0, exports.drawBorderSegments)(columnWidths, parameters);
    const { drawVerticalLine, horizontalBorderIndex, spanningCellManager } = parameters;
    return (0, drawContent_1.drawContent)({
        contents: borderSegments,
        drawSeparator: drawVerticalLine,
        elementType: 'border',
        rowIndex: horizontalBorderIndex,
        separatorGetter: (0, exports.createSeparatorGetter)(parameters),
        spanningCellManager,
    }) + '\n';
};
exports.drawBorder = drawBorder;
const drawBorderTop = (columnWidths, parameters) => {
    const { border } = parameters;
    const result = (0, exports.drawBorder)(columnWidths, {
        ...parameters,
        separator: {
            body: border.topBody,
            join: border.topJoin,
            left: border.topLeft,
            right: border.topRight,
        },
    });
    if (result === '\n') {
        return '';
    }
    return result;
};
exports.drawBorderTop = drawBorderTop;
const drawBorderJoin = (columnWidths, parameters) => {
    const { border } = parameters;
    return (0, exports.drawBorder)(columnWidths, {
        ...parameters,
        separator: {
            body: border.joinBody,
            bodyJoinInner: border.bodyJoin,
            bodyJoinOuter: border.bodyLeft,
            join: border.joinJoin,
            joinDown: border.joinMiddleDown,
            joinLeft: border.joinMiddleLeft,
            joinRight: border.joinMiddleRight,
            joinUp: border.joinMiddleUp,
            left: border.joinLeft,
            right: border.joinRight,
        },
    });
};
exports.drawBorderJoin = drawBorderJoin;
const drawBorderBottom = (columnWidths, parameters) => {
    const { border } = parameters;
    return (0, exports.drawBorder)(columnWidths, {
        ...parameters,
        separator: {
            body: border.bottomBody,
            join: border.bottomJoin,
            left: border.bottomLeft,
            right: border.bottomRight,
        },
    });
};
exports.drawBorderBottom = drawBorderBottom;
const createTableBorderGetter = (columnWidths, parameters) => {
    return (index, size) => {
        const drawBorderParameters = { ...parameters,
            horizontalBorderIndex: index };
        if (index === 0) {
            return (0, exports.drawBorderTop)(columnWidths, drawBorderParameters);
        }
        else if (index === size) {
            return (0, exports.drawBorderBottom)(columnWidths, drawBorderParameters);
        }
        return (0, exports.drawBorderJoin)(columnWidths, drawBorderParameters);
    };
};
exports.createTableBorderGetter = createTableBorderGetter;
//# sourceMappingURL=drawBorder.js.map

/***/ }),

/***/ 6499:
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.drawContent = void 0;
const drawContent = (parameters) => {
    const { contents, separatorGetter, drawSeparator, spanningCellManager, rowIndex, elementType } = parameters;
    const contentSize = contents.length;
    const result = [];
    if (drawSeparator(0, contentSize)) {
        result.push(separatorGetter(0, contentSize));
    }
    contents.forEach((content, contentIndex) => {
        if (!elementType || elementType === 'border' || elementType === 'row') {
            result.push(content);
        }
        if (elementType === 'cell' && rowIndex === undefined) {
            result.push(content);
        }
        if (elementType === 'cell' && rowIndex !== undefined) {
            /* istanbul ignore next */
            const containingRange = spanningCellManager === null || spanningCellManager === void 0 ? void 0 : spanningCellManager.getContainingRange({ col: contentIndex,
                row: rowIndex });
            // when drawing content row, just add a cell when it is a normal cell
            // or belongs to first column of spanning cell
            if (!containingRange || contentIndex === containingRange.topLeft.col) {
                result.push(content);
            }
        }
        // Only append the middle separator if the content is not the last
        if (contentIndex + 1 < contentSize && drawSeparator(contentIndex + 1, contentSize)) {
            const separator = separatorGetter(contentIndex + 1, contentSize);
            if (elementType === 'cell' && rowIndex !== undefined) {
                const currentCell = { col: contentIndex + 1,
                    row: rowIndex };
                /* istanbul ignore next */
                const containingRange = spanningCellManager === null || spanningCellManager === void 0 ? void 0 : spanningCellManager.getContainingRange(currentCell);
                if (!containingRange || containingRange.topLeft.col === currentCell.col) {
                    result.push(separator);
                }
            }
            else {
                result.push(separator);
            }
        }
    });
    if (drawSeparator(contentSize, contentSize)) {
        result.push(separatorGetter(contentSize, contentSize));
    }
    return result.join('');
};
exports.drawContent = drawContent;
//# sourceMappingURL=drawContent.js.map

/***/ }),

/***/ 2698:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.drawRow = void 0;
const drawContent_1 = __nccwpck_require__(6499);
const drawRow = (row, config) => {
    const { border, drawVerticalLine, rowIndex, spanningCellManager } = config;
    return (0, drawContent_1.drawContent)({
        contents: row,
        drawSeparator: drawVerticalLine,
        elementType: 'cell',
        rowIndex,
        separatorGetter: (index, columnCount) => {
            if (index === 0) {
                return border.bodyLeft;
            }
            if (index === columnCount) {
                return border.bodyRight;
            }
            return border.bodyJoin;
        },
        spanningCellManager,
    }) + '\n';
};
exports.drawRow = drawRow;
//# sourceMappingURL=drawRow.js.map

/***/ }),

/***/ 7910:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.drawTable = void 0;
const drawBorder_1 = __nccwpck_require__(46);
const drawContent_1 = __nccwpck_require__(6499);
const drawRow_1 = __nccwpck_require__(2698);
const utils_1 = __nccwpck_require__(1497);
const drawTable = (rows, outputColumnWidths, rowHeights, config) => {
    const { drawHorizontalLine, singleLine, } = config;
    const contents = (0, utils_1.groupBySizes)(rows, rowHeights).map((group, groupIndex) => {
        return group.map((row) => {
            return (0, drawRow_1.drawRow)(row, { ...config,
                rowIndex: groupIndex });
        }).join('');
    });
    return (0, drawContent_1.drawContent)({ contents,
        drawSeparator: (index, size) => {
            // Top/bottom border
            if (index === 0 || index === size) {
                return drawHorizontalLine(index, size);
            }
            return !singleLine && drawHorizontalLine(index, size);
        },
        elementType: 'row',
        rowIndex: -1,
        separatorGetter: (0, drawBorder_1.createTableBorderGetter)(outputColumnWidths, { ...config,
            rowCount: contents.length }),
        spanningCellManager: config.spanningCellManager });
};
exports.drawTable = drawTable;
//# sourceMappingURL=drawTable.js.map

/***/ }),

/***/ 1423:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {


exports["config.json"] = validate43;
const schema13 = {
    "$id": "config.json",
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
        "border": {
            "$ref": "shared.json#/definitions/borders"
        },
        "header": {
            "type": "object",
            "properties": {
                "content": {
                    "type": "string"
                },
                "alignment": {
                    "$ref": "shared.json#/definitions/alignment"
                },
                "wrapWord": {
                    "type": "boolean"
                },
                "truncate": {
                    "type": "integer"
                },
                "paddingLeft": {
                    "type": "integer"
                },
                "paddingRight": {
                    "type": "integer"
                }
            },
            "required": ["content"],
            "additionalProperties": false
        },
        "columns": {
            "$ref": "shared.json#/definitions/columns"
        },
        "columnDefault": {
            "$ref": "shared.json#/definitions/column"
        },
        "drawVerticalLine": {
            "typeof": "function"
        },
        "drawHorizontalLine": {
            "typeof": "function"
        },
        "singleLine": {
            "typeof": "boolean"
        },
        "spanningCells": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "col": {
                        "type": "integer",
                        "minimum": 0
                    },
                    "row": {
                        "type": "integer",
                        "minimum": 0
                    },
                    "colSpan": {
                        "type": "integer",
                        "minimum": 1
                    },
                    "rowSpan": {
                        "type": "integer",
                        "minimum": 1
                    },
                    "alignment": {
                        "$ref": "shared.json#/definitions/alignment"
                    },
                    "verticalAlignment": {
                        "$ref": "shared.json#/definitions/verticalAlignment"
                    },
                    "wrapWord": {
                        "type": "boolean"
                    },
                    "truncate": {
                        "type": "integer"
                    },
                    "paddingLeft": {
                        "type": "integer"
                    },
                    "paddingRight": {
                        "type": "integer"
                    }
                },
                "required": ["row", "col"],
                "additionalProperties": false
            }
        }
    },
    "additionalProperties": false
};
const schema15 = {
    "type": "object",
    "properties": {
        "topBody": {
            "$ref": "#/definitions/border"
        },
        "topJoin": {
            "$ref": "#/definitions/border"
        },
        "topLeft": {
            "$ref": "#/definitions/border"
        },
        "topRight": {
            "$ref": "#/definitions/border"
        },
        "bottomBody": {
            "$ref": "#/definitions/border"
        },
        "bottomJoin": {
            "$ref": "#/definitions/border"
        },
        "bottomLeft": {
            "$ref": "#/definitions/border"
        },
        "bottomRight": {
            "$ref": "#/definitions/border"
        },
        "bodyLeft": {
            "$ref": "#/definitions/border"
        },
        "bodyRight": {
            "$ref": "#/definitions/border"
        },
        "bodyJoin": {
            "$ref": "#/definitions/border"
        },
        "headerJoin": {
            "$ref": "#/definitions/border"
        },
        "joinBody": {
            "$ref": "#/definitions/border"
        },
        "joinLeft": {
            "$ref": "#/definitions/border"
        },
        "joinRight": {
            "$ref": "#/definitions/border"
        },
        "joinJoin": {
            "$ref": "#/definitions/border"
        },
        "joinMiddleUp": {
            "$ref": "#/definitions/border"
        },
        "joinMiddleDown": {
            "$ref": "#/definitions/border"
        },
        "joinMiddleLeft": {
            "$ref": "#/definitions/border"
        },
        "joinMiddleRight": {
            "$ref": "#/definitions/border"
        }
    },
    "additionalProperties": false
};
const func8 = Object.prototype.hasOwnProperty;
const schema16 = {
    "type": "string"
};
function validate46(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
    let vErrors = null;
    let errors = 0;
    if (typeof data !== "string") {
        const err0 = {
            instancePath,
            schemaPath: "#/type",
            keyword: "type",
            params: {
                type: "string"
            },
            message: "must be string"
        };
        if (vErrors === null) {
            vErrors = [err0];
        }
        else {
            vErrors.push(err0);
        }
        errors++;
    }
    validate46.errors = vErrors;
    return errors === 0;
}
function validate45(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
    let vErrors = null;
    let errors = 0;
    if (data && typeof data == "object" && !Array.isArray(data)) {
        for (const key0 in data) {
            if (!(func8.call(schema15.properties, key0))) {
                const err0 = {
                    instancePath,
                    schemaPath: "#/additionalProperties",
                    keyword: "additionalProperties",
                    params: {
                        additionalProperty: key0
                    },
                    message: "must NOT have additional properties"
                };
                if (vErrors === null) {
                    vErrors = [err0];
                }
                else {
                    vErrors.push(err0);
                }
                errors++;
            }
        }
        if (data.topBody !== undefined) {
            if (!(validate46(data.topBody, {
                instancePath: instancePath + "/topBody",
                parentData: data,
                parentDataProperty: "topBody",
                rootData
            }))) {
                vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
                errors = vErrors.length;
            }
        }
        if (data.topJoin !== undefined) {
            if (!(validate46(data.topJoin, {
                instancePath: instancePath + "/topJoin",
                parentData: data,
                parentDataProperty: "topJoin",
                rootData
            }))) {
                vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
                errors = vErrors.length;
            }
        }
        if (data.topLeft !== undefined) {
            if (!(validate46(data.topLeft, {
                instancePath: instancePath + "/topLeft",
                parentData: data,
                parentDataProperty: "topLeft",
                rootData
            }))) {
                vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
                errors = vErrors.length;
            }
        }
        if (data.topRight !== undefined) {
            if (!(validate46(data.topRight, {
                instancePath: instancePath + "/topRight",
                parentData: data,
                parentDataProperty: "topRight",
                rootData
            }))) {
                vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
                errors = vErrors.length;
            }
        }
        if (data.bottomBody !== undefined) {
            if (!(validate46(data.bottomBody, {
                instancePath: instancePath + "/bottomBody",
                parentData: data,
                parentDataProperty: "bottomBody",
                rootData
            }))) {
                vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
                errors = vErrors.length;
            }
        }
        if (data.bottomJoin !== undefined) {
            if (!(validate46(data.bottomJoin, {
                instancePath: instancePath + "/bottomJoin",
                parentData: data,
                parentDataProperty: "bottomJoin",
                rootData
            }))) {
                vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
                errors = vErrors.length;
            }
        }
        if (data.bottomLeft !== undefined) {
            if (!(validate46(data.bottomLeft, {
                instancePath: instancePath + "/bottomLeft",
                parentData: data,
                parentDataProperty: "bottomLeft",
                rootData
            }))) {
                vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
                errors = vErrors.length;
            }
        }
        if (data.bottomRight !== undefined) {
            if (!(validate46(data.bottomRight, {
                instancePath: instancePath + "/bottomRight",
                parentData: data,
                parentDataProperty: "bottomRight",
                rootData
            }))) {
                vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
                errors = vErrors.length;
            }
        }
        if (data.bodyLeft !== undefined) {
            if (!(validate46(data.bodyLeft, {
                instancePath: instancePath + "/bodyLeft",
                parentData: data,
                parentDataProperty: "bodyLeft",
                rootData
            }))) {
                vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
                errors = vErrors.length;
            }
        }
        if (data.bodyRight !== undefined) {
            if (!(validate46(data.bodyRight, {
                instancePath: instancePath + "/bodyRight",
                parentData: data,
                parentDataProperty: "bodyRight",
                rootData
            }))) {
                vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
                errors = vErrors.length;
            }
        }
        if (data.bodyJoin !== undefined) {
            if (!(validate46(data.bodyJoin, {
                instancePath: instancePath + "/bodyJoin",
                parentData: data,
                parentDataProperty: "bodyJoin",
                rootData
            }))) {
                vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
                errors = vErrors.length;
            }
        }
        if (data.headerJoin !== undefined) {
            if (!(validate46(data.headerJoin, {
                instancePath: instancePath + "/headerJoin",
                parentData: data,
                parentDataProperty: "headerJoin",
                rootData
            }))) {
                vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
                errors = vErrors.length;
            }
        }
        if (data.joinBody !== undefined) {
            if (!(validate46(data.joinBody, {
                instancePath: instancePath + "/joinBody",
                parentData: data,
                parentDataProperty: "joinBody",
                rootData
            }))) {
                vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
                errors = vErrors.length;
            }
        }
        if (data.joinLeft !== undefined) {
            if (!(validate46(data.joinLeft, {
                instancePath: instancePath + "/joinLeft",
                parentData: data,
                parentDataProperty: "joinLeft",
                rootData
            }))) {
                vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
                errors = vErrors.length;
            }
        }
        if (data.joinRight !== undefined) {
            if (!(validate46(data.joinRight, {
                instancePath: instancePath + "/joinRight",
                parentData: data,
                parentDataProperty: "joinRight",
                rootData
            }))) {
                vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
                errors = vErrors.length;
            }
        }
        if (data.joinJoin !== undefined) {
            if (!(validate46(data.joinJoin, {
                instancePath: instancePath + "/joinJoin",
                parentData: data,
                parentDataProperty: "joinJoin",
                rootData
            }))) {
                vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
                errors = vErrors.length;
            }
        }
        if (data.joinMiddleUp !== undefined) {
            if (!(validate46(data.joinMiddleUp, {
                instancePath: instancePath + "/joinMiddleUp",
                parentData: data,
                parentDataProperty: "joinMiddleUp",
                rootData
            }))) {
                vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
                errors = vErrors.length;
            }
        }
        if (data.joinMiddleDown !== undefined) {
            if (!(validate46(data.joinMiddleDown, {
                instancePath: instancePath + "/joinMiddleDown",
                parentData: data,
                parentDataProperty: "joinMiddleDown",
                rootData
            }))) {
                vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
                errors = vErrors.length;
            }
        }
        if (data.joinMiddleLeft !== undefined) {
            if (!(validate46(data.joinMiddleLeft, {
                instancePath: instancePath + "/joinMiddleLeft",
                parentData: data,
                parentDataProperty: "joinMiddleLeft",
                rootData
            }))) {
                vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
                errors = vErrors.length;
            }
        }
        if (data.joinMiddleRight !== undefined) {
            if (!(validate46(data.joinMiddleRight, {
                instancePath: instancePath + "/joinMiddleRight",
                parentData: data,
                parentDataProperty: "joinMiddleRight",
                rootData
            }))) {
                vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
                errors = vErrors.length;
            }
        }
    }
    else {
        const err1 = {
            instancePath,
            schemaPath: "#/type",
            keyword: "type",
            params: {
                type: "object"
            },
            message: "must be object"
        };
        if (vErrors === null) {
            vErrors = [err1];
        }
        else {
            vErrors.push(err1);
        }
        errors++;
    }
    validate45.errors = vErrors;
    return errors === 0;
}
const schema17 = {
    "type": "string",
    "enum": ["left", "right", "center", "justify"]
};
const func0 = (__nccwpck_require__(3855)/* ["default"] */ .A);
function validate68(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
    let vErrors = null;
    let errors = 0;
    if (typeof data !== "string") {
        const err0 = {
            instancePath,
            schemaPath: "#/type",
            keyword: "type",
            params: {
                type: "string"
            },
            message: "must be string"
        };
        if (vErrors === null) {
            vErrors = [err0];
        }
        else {
            vErrors.push(err0);
        }
        errors++;
    }
    if (!((((data === "left") || (data === "right")) || (data === "center")) || (data === "justify"))) {
        const err1 = {
            instancePath,
            schemaPath: "#/enum",
            keyword: "enum",
            params: {
                allowedValues: schema17.enum
            },
            message: "must be equal to one of the allowed values"
        };
        if (vErrors === null) {
            vErrors = [err1];
        }
        else {
            vErrors.push(err1);
        }
        errors++;
    }
    validate68.errors = vErrors;
    return errors === 0;
}
const schema18 = {
    "oneOf": [{
            "type": "object",
            "patternProperties": {
                "^[0-9]+$": {
                    "$ref": "#/definitions/column"
                }
            },
            "additionalProperties": false
        }, {
            "type": "array",
            "items": {
                "$ref": "#/definitions/column"
            }
        }]
};
const pattern0 = new RegExp("^[0-9]+$", "u");
const schema19 = {
    "type": "object",
    "properties": {
        "alignment": {
            "$ref": "#/definitions/alignment"
        },
        "verticalAlignment": {
            "$ref": "#/definitions/verticalAlignment"
        },
        "width": {
            "type": "integer",
            "minimum": 1
        },
        "wrapWord": {
            "type": "boolean"
        },
        "truncate": {
            "type": "integer"
        },
        "paddingLeft": {
            "type": "integer"
        },
        "paddingRight": {
            "type": "integer"
        }
    },
    "additionalProperties": false
};
function validate72(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
    let vErrors = null;
    let errors = 0;
    if (typeof data !== "string") {
        const err0 = {
            instancePath,
            schemaPath: "#/type",
            keyword: "type",
            params: {
                type: "string"
            },
            message: "must be string"
        };
        if (vErrors === null) {
            vErrors = [err0];
        }
        else {
            vErrors.push(err0);
        }
        errors++;
    }
    if (!((((data === "left") || (data === "right")) || (data === "center")) || (data === "justify"))) {
        const err1 = {
            instancePath,
            schemaPath: "#/enum",
            keyword: "enum",
            params: {
                allowedValues: schema17.enum
            },
            message: "must be equal to one of the allowed values"
        };
        if (vErrors === null) {
            vErrors = [err1];
        }
        else {
            vErrors.push(err1);
        }
        errors++;
    }
    validate72.errors = vErrors;
    return errors === 0;
}
const schema21 = {
    "type": "string",
    "enum": ["top", "middle", "bottom"]
};
function validate74(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
    let vErrors = null;
    let errors = 0;
    if (typeof data !== "string") {
        const err0 = {
            instancePath,
            schemaPath: "#/type",
            keyword: "type",
            params: {
                type: "string"
            },
            message: "must be string"
        };
        if (vErrors === null) {
            vErrors = [err0];
        }
        else {
            vErrors.push(err0);
        }
        errors++;
    }
    if (!(((data === "top") || (data === "middle")) || (data === "bottom"))) {
        const err1 = {
            instancePath,
            schemaPath: "#/enum",
            keyword: "enum",
            params: {
                allowedValues: schema21.enum
            },
            message: "must be equal to one of the allowed values"
        };
        if (vErrors === null) {
            vErrors = [err1];
        }
        else {
            vErrors.push(err1);
        }
        errors++;
    }
    validate74.errors = vErrors;
    return errors === 0;
}
function validate71(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
    let vErrors = null;
    let errors = 0;
    if (data && typeof data == "object" && !Array.isArray(data)) {
        for (const key0 in data) {
            if (!(((((((key0 === "alignment") || (key0 === "verticalAlignment")) || (key0 === "width")) || (key0 === "wrapWord")) || (key0 === "truncate")) || (key0 === "paddingLeft")) || (key0 === "paddingRight"))) {
                const err0 = {
                    instancePath,
                    schemaPath: "#/additionalProperties",
                    keyword: "additionalProperties",
                    params: {
                        additionalProperty: key0
                    },
                    message: "must NOT have additional properties"
                };
                if (vErrors === null) {
                    vErrors = [err0];
                }
                else {
                    vErrors.push(err0);
                }
                errors++;
            }
        }
        if (data.alignment !== undefined) {
            if (!(validate72(data.alignment, {
                instancePath: instancePath + "/alignment",
                parentData: data,
                parentDataProperty: "alignment",
                rootData
            }))) {
                vErrors = vErrors === null ? validate72.errors : vErrors.concat(validate72.errors);
                errors = vErrors.length;
            }
        }
        if (data.verticalAlignment !== undefined) {
            if (!(validate74(data.verticalAlignment, {
                instancePath: instancePath + "/verticalAlignment",
                parentData: data,
                parentDataProperty: "verticalAlignment",
                rootData
            }))) {
                vErrors = vErrors === null ? validate74.errors : vErrors.concat(validate74.errors);
                errors = vErrors.length;
            }
        }
        if (data.width !== undefined) {
            let data2 = data.width;
            if (!(((typeof data2 == "number") && (!(data2 % 1) && !isNaN(data2))) && (isFinite(data2)))) {
                const err1 = {
                    instancePath: instancePath + "/width",
                    schemaPath: "#/properties/width/type",
                    keyword: "type",
                    params: {
                        type: "integer"
                    },
                    message: "must be integer"
                };
                if (vErrors === null) {
                    vErrors = [err1];
                }
                else {
                    vErrors.push(err1);
                }
                errors++;
            }
            if ((typeof data2 == "number") && (isFinite(data2))) {
                if (data2 < 1 || isNaN(data2)) {
                    const err2 = {
                        instancePath: instancePath + "/width",
                        schemaPath: "#/properties/width/minimum",
                        keyword: "minimum",
                        params: {
                            comparison: ">=",
                            limit: 1
                        },
                        message: "must be >= 1"
                    };
                    if (vErrors === null) {
                        vErrors = [err2];
                    }
                    else {
                        vErrors.push(err2);
                    }
                    errors++;
                }
            }
        }
        if (data.wrapWord !== undefined) {
            if (typeof data.wrapWord !== "boolean") {
                const err3 = {
                    instancePath: instancePath + "/wrapWord",
                    schemaPath: "#/properties/wrapWord/type",
                    keyword: "type",
                    params: {
                        type: "boolean"
                    },
                    message: "must be boolean"
                };
                if (vErrors === null) {
                    vErrors = [err3];
                }
                else {
                    vErrors.push(err3);
                }
                errors++;
            }
        }
        if (data.truncate !== undefined) {
            let data4 = data.truncate;
            if (!(((typeof data4 == "number") && (!(data4 % 1) && !isNaN(data4))) && (isFinite(data4)))) {
                const err4 = {
                    instancePath: instancePath + "/truncate",
                    schemaPath: "#/properties/truncate/type",
                    keyword: "type",
                    params: {
                        type: "integer"
                    },
                    message: "must be integer"
                };
                if (vErrors === null) {
                    vErrors = [err4];
                }
                else {
                    vErrors.push(err4);
                }
                errors++;
            }
        }
        if (data.paddingLeft !== undefined) {
            let data5 = data.paddingLeft;
            if (!(((typeof data5 == "number") && (!(data5 % 1) && !isNaN(data5))) && (isFinite(data5)))) {
                const err5 = {
                    instancePath: instancePath + "/paddingLeft",
                    schemaPath: "#/properties/paddingLeft/type",
                    keyword: "type",
                    params: {
                        type: "integer"
                    },
                    message: "must be integer"
                };
                if (vErrors === null) {
                    vErrors = [err5];
                }
                else {
                    vErrors.push(err5);
                }
                errors++;
            }
        }
        if (data.paddingRight !== undefined) {
            let data6 = data.paddingRight;
            if (!(((typeof data6 == "number") && (!(data6 % 1) && !isNaN(data6))) && (isFinite(data6)))) {
                const err6 = {
                    instancePath: instancePath + "/paddingRight",
                    schemaPath: "#/properties/paddingRight/type",
                    keyword: "type",
                    params: {
                        type: "integer"
                    },
                    message: "must be integer"
                };
                if (vErrors === null) {
                    vErrors = [err6];
                }
                else {
                    vErrors.push(err6);
                }
                errors++;
            }
        }
    }
    else {
        const err7 = {
            instancePath,
            schemaPath: "#/type",
            keyword: "type",
            params: {
                type: "object"
            },
            message: "must be object"
        };
        if (vErrors === null) {
            vErrors = [err7];
        }
        else {
            vErrors.push(err7);
        }
        errors++;
    }
    validate71.errors = vErrors;
    return errors === 0;
}
function validate70(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
    let vErrors = null;
    let errors = 0;
    const _errs0 = errors;
    let valid0 = false;
    let passing0 = null;
    const _errs1 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
        for (const key0 in data) {
            if (!(pattern0.test(key0))) {
                const err0 = {
                    instancePath,
                    schemaPath: "#/oneOf/0/additionalProperties",
                    keyword: "additionalProperties",
                    params: {
                        additionalProperty: key0
                    },
                    message: "must NOT have additional properties"
                };
                if (vErrors === null) {
                    vErrors = [err0];
                }
                else {
                    vErrors.push(err0);
                }
                errors++;
            }
        }
        for (const key1 in data) {
            if (pattern0.test(key1)) {
                if (!(validate71(data[key1], {
                    instancePath: instancePath + "/" + key1.replace(/~/g, "~0").replace(/\//g, "~1"),
                    parentData: data,
                    parentDataProperty: key1,
                    rootData
                }))) {
                    vErrors = vErrors === null ? validate71.errors : vErrors.concat(validate71.errors);
                    errors = vErrors.length;
                }
            }
        }
    }
    else {
        const err1 = {
            instancePath,
            schemaPath: "#/oneOf/0/type",
            keyword: "type",
            params: {
                type: "object"
            },
            message: "must be object"
        };
        if (vErrors === null) {
            vErrors = [err1];
        }
        else {
            vErrors.push(err1);
        }
        errors++;
    }
    var _valid0 = _errs1 === errors;
    if (_valid0) {
        valid0 = true;
        passing0 = 0;
    }
    const _errs5 = errors;
    if (Array.isArray(data)) {
        const len0 = data.length;
        for (let i0 = 0; i0 < len0; i0++) {
            if (!(validate71(data[i0], {
                instancePath: instancePath + "/" + i0,
                parentData: data,
                parentDataProperty: i0,
                rootData
            }))) {
                vErrors = vErrors === null ? validate71.errors : vErrors.concat(validate71.errors);
                errors = vErrors.length;
            }
        }
    }
    else {
        const err2 = {
            instancePath,
            schemaPath: "#/oneOf/1/type",
            keyword: "type",
            params: {
                type: "array"
            },
            message: "must be array"
        };
        if (vErrors === null) {
            vErrors = [err2];
        }
        else {
            vErrors.push(err2);
        }
        errors++;
    }
    var _valid0 = _errs5 === errors;
    if (_valid0 && valid0) {
        valid0 = false;
        passing0 = [passing0, 1];
    }
    else {
        if (_valid0) {
            valid0 = true;
            passing0 = 1;
        }
    }
    if (!valid0) {
        const err3 = {
            instancePath,
            schemaPath: "#/oneOf",
            keyword: "oneOf",
            params: {
                passingSchemas: passing0
            },
            message: "must match exactly one schema in oneOf"
        };
        if (vErrors === null) {
            vErrors = [err3];
        }
        else {
            vErrors.push(err3);
        }
        errors++;
    }
    else {
        errors = _errs0;
        if (vErrors !== null) {
            if (_errs0) {
                vErrors.length = _errs0;
            }
            else {
                vErrors = null;
            }
        }
    }
    validate70.errors = vErrors;
    return errors === 0;
}
function validate79(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
    let vErrors = null;
    let errors = 0;
    if (data && typeof data == "object" && !Array.isArray(data)) {
        for (const key0 in data) {
            if (!(((((((key0 === "alignment") || (key0 === "verticalAlignment")) || (key0 === "width")) || (key0 === "wrapWord")) || (key0 === "truncate")) || (key0 === "paddingLeft")) || (key0 === "paddingRight"))) {
                const err0 = {
                    instancePath,
                    schemaPath: "#/additionalProperties",
                    keyword: "additionalProperties",
                    params: {
                        additionalProperty: key0
                    },
                    message: "must NOT have additional properties"
                };
                if (vErrors === null) {
                    vErrors = [err0];
                }
                else {
                    vErrors.push(err0);
                }
                errors++;
            }
        }
        if (data.alignment !== undefined) {
            if (!(validate72(data.alignment, {
                instancePath: instancePath + "/alignment",
                parentData: data,
                parentDataProperty: "alignment",
                rootData
            }))) {
                vErrors = vErrors === null ? validate72.errors : vErrors.concat(validate72.errors);
                errors = vErrors.length;
            }
        }
        if (data.verticalAlignment !== undefined) {
            if (!(validate74(data.verticalAlignment, {
                instancePath: instancePath + "/verticalAlignment",
                parentData: data,
                parentDataProperty: "verticalAlignment",
                rootData
            }))) {
                vErrors = vErrors === null ? validate74.errors : vErrors.concat(validate74.errors);
                errors = vErrors.length;
            }
        }
        if (data.width !== undefined) {
            let data2 = data.width;
            if (!(((typeof data2 == "number") && (!(data2 % 1) && !isNaN(data2))) && (isFinite(data2)))) {
                const err1 = {
                    instancePath: instancePath + "/width",
                    schemaPath: "#/properties/width/type",
                    keyword: "type",
                    params: {
                        type: "integer"
                    },
                    message: "must be integer"
                };
                if (vErrors === null) {
                    vErrors = [err1];
                }
                else {
                    vErrors.push(err1);
                }
                errors++;
            }
            if ((typeof data2 == "number") && (isFinite(data2))) {
                if (data2 < 1 || isNaN(data2)) {
                    const err2 = {
                        instancePath: instancePath + "/width",
                        schemaPath: "#/properties/width/minimum",
                        keyword: "minimum",
                        params: {
                            comparison: ">=",
                            limit: 1
                        },
                        message: "must be >= 1"
                    };
                    if (vErrors === null) {
                        vErrors = [err2];
                    }
                    else {
                        vErrors.push(err2);
                    }
                    errors++;
                }
            }
        }
        if (data.wrapWord !== undefined) {
            if (typeof data.wrapWord !== "boolean") {
                const err3 = {
                    instancePath: instancePath + "/wrapWord",
                    schemaPath: "#/properties/wrapWord/type",
                    keyword: "type",
                    params: {
                        type: "boolean"
                    },
                    message: "must be boolean"
                };
                if (vErrors === null) {
                    vErrors = [err3];
                }
                else {
                    vErrors.push(err3);
                }
                errors++;
            }
        }
        if (data.truncate !== undefined) {
            let data4 = data.truncate;
            if (!(((typeof data4 == "number") && (!(data4 % 1) && !isNaN(data4))) && (isFinite(data4)))) {
                const err4 = {
                    instancePath: instancePath + "/truncate",
                    schemaPath: "#/properties/truncate/type",
                    keyword: "type",
                    params: {
                        type: "integer"
                    },
                    message: "must be integer"
                };
                if (vErrors === null) {
                    vErrors = [err4];
                }
                else {
                    vErrors.push(err4);
                }
                errors++;
            }
        }
        if (data.paddingLeft !== undefined) {
            let data5 = data.paddingLeft;
            if (!(((typeof data5 == "number") && (!(data5 % 1) && !isNaN(data5))) && (isFinite(data5)))) {
                const err5 = {
                    instancePath: instancePath + "/paddingLeft",
                    schemaPath: "#/properties/paddingLeft/type",
                    keyword: "type",
                    params: {
                        type: "integer"
                    },
                    message: "must be integer"
                };
                if (vErrors === null) {
                    vErrors = [err5];
                }
                else {
                    vErrors.push(err5);
                }
                errors++;
            }
        }
        if (data.paddingRight !== undefined) {
            let data6 = data.paddingRight;
            if (!(((typeof data6 == "number") && (!(data6 % 1) && !isNaN(data6))) && (isFinite(data6)))) {
                const err6 = {
                    instancePath: instancePath + "/paddingRight",
                    schemaPath: "#/properties/paddingRight/type",
                    keyword: "type",
                    params: {
                        type: "integer"
                    },
                    message: "must be integer"
                };
                if (vErrors === null) {
                    vErrors = [err6];
                }
                else {
                    vErrors.push(err6);
                }
                errors++;
            }
        }
    }
    else {
        const err7 = {
            instancePath,
            schemaPath: "#/type",
            keyword: "type",
            params: {
                type: "object"
            },
            message: "must be object"
        };
        if (vErrors === null) {
            vErrors = [err7];
        }
        else {
            vErrors.push(err7);
        }
        errors++;
    }
    validate79.errors = vErrors;
    return errors === 0;
}
function validate84(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
    let vErrors = null;
    let errors = 0;
    if (typeof data !== "string") {
        const err0 = {
            instancePath,
            schemaPath: "#/type",
            keyword: "type",
            params: {
                type: "string"
            },
            message: "must be string"
        };
        if (vErrors === null) {
            vErrors = [err0];
        }
        else {
            vErrors.push(err0);
        }
        errors++;
    }
    if (!(((data === "top") || (data === "middle")) || (data === "bottom"))) {
        const err1 = {
            instancePath,
            schemaPath: "#/enum",
            keyword: "enum",
            params: {
                allowedValues: schema21.enum
            },
            message: "must be equal to one of the allowed values"
        };
        if (vErrors === null) {
            vErrors = [err1];
        }
        else {
            vErrors.push(err1);
        }
        errors++;
    }
    validate84.errors = vErrors;
    return errors === 0;
}
function validate43(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
    /*# sourceURL="config.json" */ ;
    let vErrors = null;
    let errors = 0;
    if (data && typeof data == "object" && !Array.isArray(data)) {
        for (const key0 in data) {
            if (!((((((((key0 === "border") || (key0 === "header")) || (key0 === "columns")) || (key0 === "columnDefault")) || (key0 === "drawVerticalLine")) || (key0 === "drawHorizontalLine")) || (key0 === "singleLine")) || (key0 === "spanningCells"))) {
                const err0 = {
                    instancePath,
                    schemaPath: "#/additionalProperties",
                    keyword: "additionalProperties",
                    params: {
                        additionalProperty: key0
                    },
                    message: "must NOT have additional properties"
                };
                if (vErrors === null) {
                    vErrors = [err0];
                }
                else {
                    vErrors.push(err0);
                }
                errors++;
            }
        }
        if (data.border !== undefined) {
            if (!(validate45(data.border, {
                instancePath: instancePath + "/border",
                parentData: data,
                parentDataProperty: "border",
                rootData
            }))) {
                vErrors = vErrors === null ? validate45.errors : vErrors.concat(validate45.errors);
                errors = vErrors.length;
            }
        }
        if (data.header !== undefined) {
            let data1 = data.header;
            if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
                if (data1.content === undefined) {
                    const err1 = {
                        instancePath: instancePath + "/header",
                        schemaPath: "#/properties/header/required",
                        keyword: "required",
                        params: {
                            missingProperty: "content"
                        },
                        message: "must have required property '" + "content" + "'"
                    };
                    if (vErrors === null) {
                        vErrors = [err1];
                    }
                    else {
                        vErrors.push(err1);
                    }
                    errors++;
                }
                for (const key1 in data1) {
                    if (!((((((key1 === "content") || (key1 === "alignment")) || (key1 === "wrapWord")) || (key1 === "truncate")) || (key1 === "paddingLeft")) || (key1 === "paddingRight"))) {
                        const err2 = {
                            instancePath: instancePath + "/header",
                            schemaPath: "#/properties/header/additionalProperties",
                            keyword: "additionalProperties",
                            params: {
                                additionalProperty: key1
                            },
                            message: "must NOT have additional properties"
                        };
                        if (vErrors === null) {
                            vErrors = [err2];
                        }
                        else {
                            vErrors.push(err2);
                        }
                        errors++;
                    }
                }
                if (data1.content !== undefined) {
                    if (typeof data1.content !== "string") {
                        const err3 = {
                            instancePath: instancePath + "/header/content",
                            schemaPath: "#/properties/header/properties/content/type",
                            keyword: "type",
                            params: {
                                type: "string"
                            },
                            message: "must be string"
                        };
                        if (vErrors === null) {
                            vErrors = [err3];
                        }
                        else {
                            vErrors.push(err3);
                        }
                        errors++;
                    }
                }
                if (data1.alignment !== undefined) {
                    if (!(validate68(data1.alignment, {
                        instancePath: instancePath + "/header/alignment",
                        parentData: data1,
                        parentDataProperty: "alignment",
                        rootData
                    }))) {
                        vErrors = vErrors === null ? validate68.errors : vErrors.concat(validate68.errors);
                        errors = vErrors.length;
                    }
                }
                if (data1.wrapWord !== undefined) {
                    if (typeof data1.wrapWord !== "boolean") {
                        const err4 = {
                            instancePath: instancePath + "/header/wrapWord",
                            schemaPath: "#/properties/header/properties/wrapWord/type",
                            keyword: "type",
                            params: {
                                type: "boolean"
                            },
                            message: "must be boolean"
                        };
                        if (vErrors === null) {
                            vErrors = [err4];
                        }
                        else {
                            vErrors.push(err4);
                        }
                        errors++;
                    }
                }
                if (data1.truncate !== undefined) {
                    let data5 = data1.truncate;
                    if (!(((typeof data5 == "number") && (!(data5 % 1) && !isNaN(data5))) && (isFinite(data5)))) {
                        const err5 = {
                            instancePath: instancePath + "/header/truncate",
                            schemaPath: "#/properties/header/properties/truncate/type",
                            keyword: "type",
                            params: {
                                type: "integer"
                            },
                            message: "must be integer"
                        };
                        if (vErrors === null) {
                            vErrors = [err5];
                        }
                        else {
                            vErrors.push(err5);
                        }
                        errors++;
                    }
                }
                if (data1.paddingLeft !== undefined) {
                    let data6 = data1.paddingLeft;
                    if (!(((typeof data6 == "number") && (!(data6 % 1) && !isNaN(data6))) && (isFinite(data6)))) {
                        const err6 = {
                            instancePath: instancePath + "/header/paddingLeft",
                            schemaPath: "#/properties/header/properties/paddingLeft/type",
                            keyword: "type",
                            params: {
                                type: "integer"
                            },
                            message: "must be integer"
                        };
                        if (vErrors === null) {
                            vErrors = [err6];
                        }
                        else {
                            vErrors.push(err6);
                        }
                        errors++;
                    }
                }
                if (data1.paddingRight !== undefined) {
                    let data7 = data1.paddingRight;
                    if (!(((typeof data7 == "number") && (!(data7 % 1) && !isNaN(data7))) && (isFinite(data7)))) {
                        const err7 = {
                            instancePath: instancePath + "/header/paddingRight",
                            schemaPath: "#/properties/header/properties/paddingRight/type",
                            keyword: "type",
                            params: {
                                type: "integer"
                            },
                            message: "must be integer"
                        };
                        if (vErrors === null) {
                            vErrors = [err7];
                        }
                        else {
                            vErrors.push(err7);
                        }
                        errors++;
                    }
                }
            }
            else {
                const err8 = {
                    instancePath: instancePath + "/header",
                    schemaPath: "#/properties/header/type",
                    keyword: "type",
                    params: {
                        type: "object"
                    },
                    message: "must be object"
                };
                if (vErrors === null) {
                    vErrors = [err8];
                }
                else {
                    vErrors.push(err8);
                }
                errors++;
            }
        }
        if (data.columns !== undefined) {
            if (!(validate70(data.columns, {
                instancePath: instancePath + "/columns",
                parentData: data,
                parentDataProperty: "columns",
                rootData
            }))) {
                vErrors = vErrors === null ? validate70.errors : vErrors.concat(validate70.errors);
                errors = vErrors.length;
            }
        }
        if (data.columnDefault !== undefined) {
            if (!(validate79(data.columnDefault, {
                instancePath: instancePath + "/columnDefault",
                parentData: data,
                parentDataProperty: "columnDefault",
                rootData
            }))) {
                vErrors = vErrors === null ? validate79.errors : vErrors.concat(validate79.errors);
                errors = vErrors.length;
            }
        }
        if (data.drawVerticalLine !== undefined) {
            if (typeof data.drawVerticalLine != "function") {
                const err9 = {
                    instancePath: instancePath + "/drawVerticalLine",
                    schemaPath: "#/properties/drawVerticalLine/typeof",
                    keyword: "typeof",
                    params: {},
                    message: "must pass \"typeof\" keyword validation"
                };
                if (vErrors === null) {
                    vErrors = [err9];
                }
                else {
                    vErrors.push(err9);
                }
                errors++;
            }
        }
        if (data.drawHorizontalLine !== undefined) {
            if (typeof data.drawHorizontalLine != "function") {
                const err10 = {
                    instancePath: instancePath + "/drawHorizontalLine",
                    schemaPath: "#/properties/drawHorizontalLine/typeof",
                    keyword: "typeof",
                    params: {},
                    message: "must pass \"typeof\" keyword validation"
                };
                if (vErrors === null) {
                    vErrors = [err10];
                }
                else {
                    vErrors.push(err10);
                }
                errors++;
            }
        }
        if (data.singleLine !== undefined) {
            if (typeof data.singleLine != "boolean") {
                const err11 = {
                    instancePath: instancePath + "/singleLine",
                    schemaPath: "#/properties/singleLine/typeof",
                    keyword: "typeof",
                    params: {},
                    message: "must pass \"typeof\" keyword validation"
                };
                if (vErrors === null) {
                    vErrors = [err11];
                }
                else {
                    vErrors.push(err11);
                }
                errors++;
            }
        }
        if (data.spanningCells !== undefined) {
            let data13 = data.spanningCells;
            if (Array.isArray(data13)) {
                const len0 = data13.length;
                for (let i0 = 0; i0 < len0; i0++) {
                    let data14 = data13[i0];
                    if (data14 && typeof data14 == "object" && !Array.isArray(data14)) {
                        if (data14.row === undefined) {
                            const err12 = {
                                instancePath: instancePath + "/spanningCells/" + i0,
                                schemaPath: "#/properties/spanningCells/items/required",
                                keyword: "required",
                                params: {
                                    missingProperty: "row"
                                },
                                message: "must have required property '" + "row" + "'"
                            };
                            if (vErrors === null) {
                                vErrors = [err12];
                            }
                            else {
                                vErrors.push(err12);
                            }
                            errors++;
                        }
                        if (data14.col === undefined) {
                            const err13 = {
                                instancePath: instancePath + "/spanningCells/" + i0,
                                schemaPath: "#/properties/spanningCells/items/required",
                                keyword: "required",
                                params: {
                                    missingProperty: "col"
                                },
                                message: "must have required property '" + "col" + "'"
                            };
                            if (vErrors === null) {
                                vErrors = [err13];
                            }
                            else {
                                vErrors.push(err13);
                            }
                            errors++;
                        }
                        for (const key2 in data14) {
                            if (!(func8.call(schema13.properties.spanningCells.items.properties, key2))) {
                                const err14 = {
                                    instancePath: instancePath + "/spanningCells/" + i0,
                                    schemaPath: "#/properties/spanningCells/items/additionalProperties",
                                    keyword: "additionalProperties",
                                    params: {
                                        additionalProperty: key2
                                    },
                                    message: "must NOT have additional properties"
                                };
                                if (vErrors === null) {
                                    vErrors = [err14];
                                }
                                else {
                                    vErrors.push(err14);
                                }
                                errors++;
                            }
                        }
                        if (data14.col !== undefined) {
                            let data15 = data14.col;
                            if (!(((typeof data15 == "number") && (!(data15 % 1) && !isNaN(data15))) && (isFinite(data15)))) {
                                const err15 = {
                                    instancePath: instancePath + "/spanningCells/" + i0 + "/col",
                                    schemaPath: "#/properties/spanningCells/items/properties/col/type",
                                    keyword: "type",
                                    params: {
                                        type: "integer"
                                    },
                                    message: "must be integer"
                                };
                                if (vErrors === null) {
                                    vErrors = [err15];
                                }
                                else {
                                    vErrors.push(err15);
                                }
                                errors++;
                            }
                            if ((typeof data15 == "number") && (isFinite(data15))) {
                                if (data15 < 0 || isNaN(data15)) {
                                    const err16 = {
                                        instancePath: instancePath + "/spanningCells/" + i0 + "/col",
                                        schemaPath: "#/properties/spanningCells/items/properties/col/minimum",
                                        keyword: "minimum",
                                        params: {
                                            comparison: ">=",
                                            limit: 0
                                        },
                                        message: "must be >= 0"
                                    };
                                    if (vErrors === null) {
                                        vErrors = [err16];
                                    }
                                    else {
                                        vErrors.push(err16);
                                    }
                                    errors++;
                                }
                            }
                        }
                        if (data14.row !== undefined) {
                            let data16 = data14.row;
                            if (!(((typeof data16 == "number") && (!(data16 % 1) && !isNaN(data16))) && (isFinite(data16)))) {
                                const err17 = {
                                    instancePath: instancePath + "/spanningCells/" + i0 + "/row",
                                    schemaPath: "#/properties/spanningCells/items/properties/row/type",
                                    keyword: "type",
                                    params: {
                                        type: "integer"
                                    },
                                    message: "must be integer"
                                };
                                if (vErrors === null) {
                                    vErrors = [err17];
                                }
                                else {
                                    vErrors.push(err17);
                                }
                                errors++;
                            }
                            if ((typeof data16 == "number") && (isFinite(data16))) {
                                if (data16 < 0 || isNaN(data16)) {
                                    const err18 = {
                                        instancePath: instancePath + "/spanningCells/" + i0 + "/row",
                                        schemaPath: "#/properties/spanningCells/items/properties/row/minimum",
                                        keyword: "minimum",
                                        params: {
                                            comparison: ">=",
                                            limit: 0
                                        },
                                        message: "must be >= 0"
                                    };
                                    if (vErrors === null) {
                                        vErrors = [err18];
                                    }
                                    else {
                                        vErrors.push(err18);
                                    }
                                    errors++;
                                }
                            }
                        }
                        if (data14.colSpan !== undefined) {
                            let data17 = data14.colSpan;
                            if (!(((typeof data17 == "number") && (!(data17 % 1) && !isNaN(data17))) && (isFinite(data17)))) {
                                const err19 = {
                                    instancePath: instancePath + "/spanningCells/" + i0 + "/colSpan",
                                    schemaPath: "#/properties/spanningCells/items/properties/colSpan/type",
                                    keyword: "type",
                                    params: {
                                        type: "integer"
                                    },
                                    message: "must be integer"
                                };
                                if (vErrors === null) {
                                    vErrors = [err19];
                                }
                                else {
                                    vErrors.push(err19);
                                }
                                errors++;
                            }
                            if ((typeof data17 == "number") && (isFinite(data17))) {
                                if (data17 < 1 || isNaN(data17)) {
                                    const err20 = {
                                        instancePath: instancePath + "/spanningCells/" + i0 + "/colSpan",
                                        schemaPath: "#/properties/spanningCells/items/properties/colSpan/minimum",
                                        keyword: "minimum",
                                        params: {
                                            comparison: ">=",
                                            limit: 1
                                        },
                                        message: "must be >= 1"
                                    };
                                    if (vErrors === null) {
                                        vErrors = [err20];
                                    }
                                    else {
                                        vErrors.push(err20);
                                    }
                                    errors++;
                                }
                            }
                        }
                        if (data14.rowSpan !== undefined) {
                            let data18 = data14.rowSpan;
                            if (!(((typeof data18 == "number") && (!(data18 % 1) && !isNaN(data18))) && (isFinite(data18)))) {
                                const err21 = {
                                    instancePath: instancePath + "/spanningCells/" + i0 + "/rowSpan",
                                    schemaPath: "#/properties/spanningCells/items/properties/rowSpan/type",
                                    keyword: "type",
                                    params: {
                                        type: "integer"
                                    },
                                    message: "must be integer"
                                };
                                if (vErrors === null) {
                                    vErrors = [err21];
                                }
                                else {
                                    vErrors.push(err21);
                                }
                                errors++;
                            }
                            if ((typeof data18 == "number") && (isFinite(data18))) {
                                if (data18 < 1 || isNaN(data18)) {
                                    const err22 = {
                                        instancePath: instancePath + "/spanningCells/" + i0 + "/rowSpan",
                                        schemaPath: "#/properties/spanningCells/items/properties/rowSpan/minimum",
                                        keyword: "minimum",
                                        params: {
                                            comparison: ">=",
                                            limit: 1
                                        },
                                        message: "must be >= 1"
                                    };
                                    if (vErrors === null) {
                                        vErrors = [err22];
                                    }
                                    else {
                                        vErrors.push(err22);
                                    }
                                    errors++;
                                }
                            }
                        }
                        if (data14.alignment !== undefined) {
                            if (!(validate68(data14.alignment, {
                                instancePath: instancePath + "/spanningCells/" + i0 + "/alignment",
                                parentData: data14,
                                parentDataProperty: "alignment",
                                rootData
                            }))) {
                                vErrors = vErrors === null ? validate68.errors : vErrors.concat(validate68.errors);
                                errors = vErrors.length;
                            }
                        }
                        if (data14.verticalAlignment !== undefined) {
                            if (!(validate84(data14.verticalAlignment, {
                                instancePath: instancePath + "/spanningCells/" + i0 + "/verticalAlignment",
                                parentData: data14,
                                parentDataProperty: "verticalAlignment",
                                rootData
                            }))) {
                                vErrors = vErrors === null ? validate84.errors : vErrors.concat(validate84.errors);
                                errors = vErrors.length;
                            }
                        }
                        if (data14.wrapWord !== undefined) {
                            if (typeof data14.wrapWord !== "boolean") {
                                const err23 = {
                                    instancePath: instancePath + "/spanningCells/" + i0 + "/wrapWord",
                                    schemaPath: "#/properties/spanningCells/items/properties/wrapWord/type",
                                    keyword: "type",
                                    params: {
                                        type: "boolean"
                                    },
                                    message: "must be boolean"
                                };
                                if (vErrors === null) {
                                    vErrors = [err23];
                                }
                                else {
                                    vErrors.push(err23);
                                }
                                errors++;
                            }
                        }
                        if (data14.truncate !== undefined) {
                            let data22 = data14.truncate;
                            if (!(((typeof data22 == "number") && (!(data22 % 1) && !isNaN(data22))) && (isFinite(data22)))) {
                                const err24 = {
                                    instancePath: instancePath + "/spanningCells/" + i0 + "/truncate",
                                    schemaPath: "#/properties/spanningCells/items/properties/truncate/type",
                                    keyword: "type",
                                    params: {
                                        type: "integer"
                                    },
                                    message: "must be integer"
                                };
                                if (vErrors === null) {
                                    vErrors = [err24];
                                }
                                else {
                                    vErrors.push(err24);
                                }
                                errors++;
                            }
                        }
                        if (data14.paddingLeft !== undefined) {
                            let data23 = data14.paddingLeft;
                            if (!(((typeof data23 == "number") && (!(data23 % 1) && !isNaN(data23))) && (isFinite(data23)))) {
                                const err25 = {
                                    instancePath: instancePath + "/spanningCells/" + i0 + "/paddingLeft",
                                    schemaPath: "#/properties/spanningCells/items/properties/paddingLeft/type",
                                    keyword: "type",
                                    params: {
                                        type: "integer"
                                    },
                                    message: "must be integer"
                                };
                                if (vErrors === null) {
                                    vErrors = [err25];
                                }
                                else {
                                    vErrors.push(err25);
                                }
                                errors++;
                            }
                        }
                        if (data14.paddingRight !== undefined) {
                            let data24 = data14.paddingRight;
                            if (!(((typeof data24 == "number") && (!(data24 % 1) && !isNaN(data24))) && (isFinite(data24)))) {
                                const err26 = {
                                    instancePath: instancePath + "/spanningCells/" + i0 + "/paddingRight",
                                    schemaPath: "#/properties/spanningCells/items/properties/paddingRight/type",
                                    keyword: "type",
                                    params: {
                                        type: "integer"
                                    },
                                    message: "must be integer"
                                };
                                if (vErrors === null) {
                                    vErrors = [err26];
                                }
                                else {
                                    vErrors.push(err26);
                                }
                                errors++;
                            }
                        }
                    }
                    else {
                        const err27 = {
                            instancePath: instancePath + "/spanningCells/" + i0,
                            schemaPath: "#/properties/spanningCells/items/type",
                            keyword: "type",
                            params: {
                                type: "object"
                            },
                            message: "must be object"
                        };
                        if (vErrors === null) {
                            vErrors = [err27];
                        }
                        else {
                            vErrors.push(err27);
                        }
                        errors++;
                    }
                }
            }
            else {
                const err28 = {
                    instancePath: instancePath + "/spanningCells",
                    schemaPath: "#/properties/spanningCells/type",
                    keyword: "type",
                    params: {
                        type: "array"
                    },
                    message: "must be array"
                };
                if (vErrors === null) {
                    vErrors = [err28];
                }
                else {
                    vErrors.push(err28);
                }
                errors++;
            }
        }
    }
    else {
        const err29 = {
            instancePath,
            schemaPath: "#/type",
            keyword: "type",
            params: {
                type: "object"
            },
            message: "must be object"
        };
        if (vErrors === null) {
            vErrors = [err29];
        }
        else {
            vErrors.push(err29);
        }
        errors++;
    }
    validate43.errors = vErrors;
    return errors === 0;
}
exports["streamConfig.json"] = validate86;
const schema24 = {
    "$id": "streamConfig.json",
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
        "border": {
            "$ref": "shared.json#/definitions/borders"
        },
        "columns": {
            "$ref": "shared.json#/definitions/columns"
        },
        "columnDefault": {
            "$ref": "shared.json#/definitions/column"
        },
        "columnCount": {
            "type": "integer",
            "minimum": 1
        },
        "drawVerticalLine": {
            "typeof": "function"
        }
    },
    "required": ["columnDefault", "columnCount"],
    "additionalProperties": false
};
function validate87(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
    let vErrors = null;
    let errors = 0;
    if (data && typeof data == "object" && !Array.isArray(data)) {
        for (const key0 in data) {
            if (!(func8.call(schema15.properties, key0))) {
                const err0 = {
                    instancePath,
                    schemaPath: "#/additionalProperties",
                    keyword: "additionalProperties",
                    params: {
                        additionalProperty: key0
                    },
                    message: "must NOT have additional properties"
                };
                if (vErrors === null) {
                    vErrors = [err0];
                }
                else {
                    vErrors.push(err0);
                }
                errors++;
            }
        }
        if (data.topBody !== undefined) {
            if (!(validate46(data.topBody, {
                instancePath: instancePath + "/topBody",
                parentData: data,
                parentDataProperty: "topBody",
                rootData
            }))) {
                vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
                errors = vErrors.length;
            }
        }
        if (data.topJoin !== undefined) {
            if (!(validate46(data.topJoin, {
                instancePath: instancePath + "/topJoin",
                parentData: data,
                parentDataProperty: "topJoin",
                rootData
            }))) {
                vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
                errors = vErrors.length;
            }
        }
        if (data.topLeft !== undefined) {
            if (!(validate46(data.topLeft, {
                instancePath: instancePath + "/topLeft",
                parentData: data,
                parentDataProperty: "topLeft",
                rootData
            }))) {
                vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
                errors = vErrors.length;
            }
        }
        if (data.topRight !== undefined) {
            if (!(validate46(data.topRight, {
                instancePath: instancePath + "/topRight",
                parentData: data,
                parentDataProperty: "topRight",
                rootData
            }))) {
                vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
                errors = vErrors.length;
            }
        }
        if (data.bottomBody !== undefined) {
            if (!(validate46(data.bottomBody, {
                instancePath: instancePath + "/bottomBody",
                parentData: data,
                parentDataProperty: "bottomBody",
                rootData
            }))) {
                vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
                errors = vErrors.length;
            }
        }
        if (data.bottomJoin !== undefined) {
            if (!(validate46(data.bottomJoin, {
                instancePath: instancePath + "/bottomJoin",
                parentData: data,
                parentDataProperty: "bottomJoin",
                rootData
            }))) {
                vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
                errors = vErrors.length;
            }
        }
        if (data.bottomLeft !== undefined) {
            if (!(validate46(data.bottomLeft, {
                instancePath: instancePath + "/bottomLeft",
                parentData: data,
                parentDataProperty: "bottomLeft",
                rootData
            }))) {
                vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
                errors = vErrors.length;
            }
        }
        if (data.bottomRight !== undefined) {
            if (!(validate46(data.bottomRight, {
                instancePath: instancePath + "/bottomRight",
                parentData: data,
                parentDataProperty: "bottomRight",
                rootData
            }))) {
                vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
                errors = vErrors.length;
            }
        }
        if (data.bodyLeft !== undefined) {
            if (!(validate46(data.bodyLeft, {
                instancePath: instancePath + "/bodyLeft",
                parentData: data,
                parentDataProperty: "bodyLeft",
                rootData
            }))) {
                vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
                errors = vErrors.length;
            }
        }
        if (data.bodyRight !== undefined) {
            if (!(validate46(data.bodyRight, {
                instancePath: instancePath + "/bodyRight",
                parentData: data,
                parentDataProperty: "bodyRight",
                rootData
            }))) {
                vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
                errors = vErrors.length;
            }
        }
        if (data.bodyJoin !== undefined) {
            if (!(validate46(data.bodyJoin, {
                instancePath: instancePath + "/bodyJoin",
                parentData: data,
                parentDataProperty: "bodyJoin",
                rootData
            }))) {
                vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
                errors = vErrors.length;
            }
        }
        if (data.headerJoin !== undefined) {
            if (!(validate46(data.headerJoin, {
                instancePath: instancePath + "/headerJoin",
                parentData: data,
                parentDataProperty: "headerJoin",
                rootData
            }))) {
                vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
                errors = vErrors.length;
            }
        }
        if (data.joinBody !== undefined) {
            if (!(validate46(data.joinBody, {
                instancePath: instancePath + "/joinBody",
                parentData: data,
                parentDataProperty: "joinBody",
                rootData
            }))) {
                vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
                errors = vErrors.length;
            }
        }
        if (data.joinLeft !== undefined) {
            if (!(validate46(data.joinLeft, {
                instancePath: instancePath + "/joinLeft",
                parentData: data,
                parentDataProperty: "joinLeft",
                rootData
            }))) {
                vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
                errors = vErrors.length;
            }
        }
        if (data.joinRight !== undefined) {
            if (!(validate46(data.joinRight, {
                instancePath: instancePath + "/joinRight",
                parentData: data,
                parentDataProperty: "joinRight",
                rootData
            }))) {
                vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
                errors = vErrors.length;
            }
        }
        if (data.joinJoin !== undefined) {
            if (!(validate46(data.joinJoin, {
                instancePath: instancePath + "/joinJoin",
                parentData: data,
                parentDataProperty: "joinJoin",
                rootData
            }))) {
                vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
                errors = vErrors.length;
            }
        }
        if (data.joinMiddleUp !== undefined) {
            if (!(validate46(data.joinMiddleUp, {
                instancePath: instancePath + "/joinMiddleUp",
                parentData: data,
                parentDataProperty: "joinMiddleUp",
                rootData
            }))) {
                vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
                errors = vErrors.length;
            }
        }
        if (data.joinMiddleDown !== undefined) {
            if (!(validate46(data.joinMiddleDown, {
                instancePath: instancePath + "/joinMiddleDown",
                parentData: data,
                parentDataProperty: "joinMiddleDown",
                rootData
            }))) {
                vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
                errors = vErrors.length;
            }
        }
        if (data.joinMiddleLeft !== undefined) {
            if (!(validate46(data.joinMiddleLeft, {
                instancePath: instancePath + "/joinMiddleLeft",
                parentData: data,
                parentDataProperty: "joinMiddleLeft",
                rootData
            }))) {
                vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
                errors = vErrors.length;
            }
        }
        if (data.joinMiddleRight !== undefined) {
            if (!(validate46(data.joinMiddleRight, {
                instancePath: instancePath + "/joinMiddleRight",
                parentData: data,
                parentDataProperty: "joinMiddleRight",
                rootData
            }))) {
                vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
                errors = vErrors.length;
            }
        }
    }
    else {
        const err1 = {
            instancePath,
            schemaPath: "#/type",
            keyword: "type",
            params: {
                type: "object"
            },
            message: "must be object"
        };
        if (vErrors === null) {
            vErrors = [err1];
        }
        else {
            vErrors.push(err1);
        }
        errors++;
    }
    validate87.errors = vErrors;
    return errors === 0;
}
function validate109(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
    let vErrors = null;
    let errors = 0;
    const _errs0 = errors;
    let valid0 = false;
    let passing0 = null;
    const _errs1 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
        for (const key0 in data) {
            if (!(pattern0.test(key0))) {
                const err0 = {
                    instancePath,
                    schemaPath: "#/oneOf/0/additionalProperties",
                    keyword: "additionalProperties",
                    params: {
                        additionalProperty: key0
                    },
                    message: "must NOT have additional properties"
                };
                if (vErrors === null) {
                    vErrors = [err0];
                }
                else {
                    vErrors.push(err0);
                }
                errors++;
            }
        }
        for (const key1 in data) {
            if (pattern0.test(key1)) {
                if (!(validate71(data[key1], {
                    instancePath: instancePath + "/" + key1.replace(/~/g, "~0").replace(/\//g, "~1"),
                    parentData: data,
                    parentDataProperty: key1,
                    rootData
                }))) {
                    vErrors = vErrors === null ? validate71.errors : vErrors.concat(validate71.errors);
                    errors = vErrors.length;
                }
            }
        }
    }
    else {
        const err1 = {
            instancePath,
            schemaPath: "#/oneOf/0/type",
            keyword: "type",
            params: {
                type: "object"
            },
            message: "must be object"
        };
        if (vErrors === null) {
            vErrors = [err1];
        }
        else {
            vErrors.push(err1);
        }
        errors++;
    }
    var _valid0 = _errs1 === errors;
    if (_valid0) {
        valid0 = true;
        passing0 = 0;
    }
    const _errs5 = errors;
    if (Array.isArray(data)) {
        const len0 = data.length;
        for (let i0 = 0; i0 < len0; i0++) {
            if (!(validate71(data[i0], {
                instancePath: instancePath + "/" + i0,
                parentData: data,
                parentDataProperty: i0,
                rootData
            }))) {
                vErrors = vErrors === null ? validate71.errors : vErrors.concat(validate71.errors);
                errors = vErrors.length;
            }
        }
    }
    else {
        const err2 = {
            instancePath,
            schemaPath: "#/oneOf/1/type",
            keyword: "type",
            params: {
                type: "array"
            },
            message: "must be array"
        };
        if (vErrors === null) {
            vErrors = [err2];
        }
        else {
            vErrors.push(err2);
        }
        errors++;
    }
    var _valid0 = _errs5 === errors;
    if (_valid0 && valid0) {
        valid0 = false;
        passing0 = [passing0, 1];
    }
    else {
        if (_valid0) {
            valid0 = true;
            passing0 = 1;
        }
    }
    if (!valid0) {
        const err3 = {
            instancePath,
            schemaPath: "#/oneOf",
            keyword: "oneOf",
            params: {
                passingSchemas: passing0
            },
            message: "must match exactly one schema in oneOf"
        };
        if (vErrors === null) {
            vErrors = [err3];
        }
        else {
            vErrors.push(err3);
        }
        errors++;
    }
    else {
        errors = _errs0;
        if (vErrors !== null) {
            if (_errs0) {
                vErrors.length = _errs0;
            }
            else {
                vErrors = null;
            }
        }
    }
    validate109.errors = vErrors;
    return errors === 0;
}
function validate113(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
    let vErrors = null;
    let errors = 0;
    if (data && typeof data == "object" && !Array.isArray(data)) {
        for (const key0 in data) {
            if (!(((((((key0 === "alignment") || (key0 === "verticalAlignment")) || (key0 === "width")) || (key0 === "wrapWord")) || (key0 === "truncate")) || (key0 === "paddingLeft")) || (key0 === "paddingRight"))) {
                const err0 = {
                    instancePath,
                    schemaPath: "#/additionalProperties",
                    keyword: "additionalProperties",
                    params: {
                        additionalProperty: key0
                    },
                    message: "must NOT have additional properties"
                };
                if (vErrors === null) {
                    vErrors = [err0];
                }
                else {
                    vErrors.push(err0);
                }
                errors++;
            }
        }
        if (data.alignment !== undefined) {
            if (!(validate72(data.alignment, {
                instancePath: instancePath + "/alignment",
                parentData: data,
                parentDataProperty: "alignment",
                rootData
            }))) {
                vErrors = vErrors === null ? validate72.errors : vErrors.concat(validate72.errors);
                errors = vErrors.length;
            }
        }
        if (data.verticalAlignment !== undefined) {
            if (!(validate74(data.verticalAlignment, {
                instancePath: instancePath + "/verticalAlignment",
                parentData: data,
                parentDataProperty: "verticalAlignment",
                rootData
            }))) {
                vErrors = vErrors === null ? validate74.errors : vErrors.concat(validate74.errors);
                errors = vErrors.length;
            }
        }
        if (data.width !== undefined) {
            let data2 = data.width;
            if (!(((typeof data2 == "number") && (!(data2 % 1) && !isNaN(data2))) && (isFinite(data2)))) {
                const err1 = {
                    instancePath: instancePath + "/width",
                    schemaPath: "#/properties/width/type",
                    keyword: "type",
                    params: {
                        type: "integer"
                    },
                    message: "must be integer"
                };
                if (vErrors === null) {
                    vErrors = [err1];
                }
                else {
                    vErrors.push(err1);
                }
                errors++;
            }
            if ((typeof data2 == "number") && (isFinite(data2))) {
                if (data2 < 1 || isNaN(data2)) {
                    const err2 = {
                        instancePath: instancePath + "/width",
                        schemaPath: "#/properties/width/minimum",
                        keyword: "minimum",
                        params: {
                            comparison: ">=",
                            limit: 1
                        },
                        message: "must be >= 1"
                    };
                    if (vErrors === null) {
                        vErrors = [err2];
                    }
                    else {
                        vErrors.push(err2);
                    }
                    errors++;
                }
            }
        }
        if (data.wrapWord !== undefined) {
            if (typeof data.wrapWord !== "boolean") {
                const err3 = {
                    instancePath: instancePath + "/wrapWord",
                    schemaPath: "#/properties/wrapWord/type",
                    keyword: "type",
                    params: {
                        type: "boolean"
                    },
                    message: "must be boolean"
                };
                if (vErrors === null) {
                    vErrors = [err3];
                }
                else {
                    vErrors.push(err3);
                }
                errors++;
            }
        }
        if (data.truncate !== undefined) {
            let data4 = data.truncate;
            if (!(((typeof data4 == "number") && (!(data4 % 1) && !isNaN(data4))) && (isFinite(data4)))) {
                const err4 = {
                    instancePath: instancePath + "/truncate",
                    schemaPath: "#/properties/truncate/type",
                    keyword: "type",
                    params: {
                        type: "integer"
                    },
                    message: "must be integer"
                };
                if (vErrors === null) {
                    vErrors = [err4];
                }
                else {
                    vErrors.push(err4);
                }
                errors++;
            }
        }
        if (data.paddingLeft !== undefined) {
            let data5 = data.paddingLeft;
            if (!(((typeof data5 == "number") && (!(data5 % 1) && !isNaN(data5))) && (isFinite(data5)))) {
                const err5 = {
                    instancePath: instancePath + "/paddingLeft",
                    schemaPath: "#/properties/paddingLeft/type",
                    keyword: "type",
                    params: {
                        type: "integer"
                    },
                    message: "must be integer"
                };
                if (vErrors === null) {
                    vErrors = [err5];
                }
                else {
                    vErrors.push(err5);
                }
                errors++;
            }
        }
        if (data.paddingRight !== undefined) {
            let data6 = data.paddingRight;
            if (!(((typeof data6 == "number") && (!(data6 % 1) && !isNaN(data6))) && (isFinite(data6)))) {
                const err6 = {
                    instancePath: instancePath + "/paddingRight",
                    schemaPath: "#/properties/paddingRight/type",
                    keyword: "type",
                    params: {
                        type: "integer"
                    },
                    message: "must be integer"
                };
                if (vErrors === null) {
                    vErrors = [err6];
                }
                else {
                    vErrors.push(err6);
                }
                errors++;
            }
        }
    }
    else {
        const err7 = {
            instancePath,
            schemaPath: "#/type",
            keyword: "type",
            params: {
                type: "object"
            },
            message: "must be object"
        };
        if (vErrors === null) {
            vErrors = [err7];
        }
        else {
            vErrors.push(err7);
        }
        errors++;
    }
    validate113.errors = vErrors;
    return errors === 0;
}
function validate86(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
    /*# sourceURL="streamConfig.json" */ ;
    let vErrors = null;
    let errors = 0;
    if (data && typeof data == "object" && !Array.isArray(data)) {
        if (data.columnDefault === undefined) {
            const err0 = {
                instancePath,
                schemaPath: "#/required",
                keyword: "required",
                params: {
                    missingProperty: "columnDefault"
                },
                message: "must have required property '" + "columnDefault" + "'"
            };
            if (vErrors === null) {
                vErrors = [err0];
            }
            else {
                vErrors.push(err0);
            }
            errors++;
        }
        if (data.columnCount === undefined) {
            const err1 = {
                instancePath,
                schemaPath: "#/required",
                keyword: "required",
                params: {
                    missingProperty: "columnCount"
                },
                message: "must have required property '" + "columnCount" + "'"
            };
            if (vErrors === null) {
                vErrors = [err1];
            }
            else {
                vErrors.push(err1);
            }
            errors++;
        }
        for (const key0 in data) {
            if (!(((((key0 === "border") || (key0 === "columns")) || (key0 === "columnDefault")) || (key0 === "columnCount")) || (key0 === "drawVerticalLine"))) {
                const err2 = {
                    instancePath,
                    schemaPath: "#/additionalProperties",
                    keyword: "additionalProperties",
                    params: {
                        additionalProperty: key0
                    },
                    message: "must NOT have additional properties"
                };
                if (vErrors === null) {
                    vErrors = [err2];
                }
                else {
                    vErrors.push(err2);
                }
                errors++;
            }
        }
        if (data.border !== undefined) {
            if (!(validate87(data.border, {
                instancePath: instancePath + "/border",
                parentData: data,
                parentDataProperty: "border",
                rootData
            }))) {
                vErrors = vErrors === null ? validate87.errors : vErrors.concat(validate87.errors);
                errors = vErrors.length;
            }
        }
        if (data.columns !== undefined) {
            if (!(validate109(data.columns, {
                instancePath: instancePath + "/columns",
                parentData: data,
                parentDataProperty: "columns",
                rootData
            }))) {
                vErrors = vErrors === null ? validate109.errors : vErrors.concat(validate109.errors);
                errors = vErrors.length;
            }
        }
        if (data.columnDefault !== undefined) {
            if (!(validate113(data.columnDefault, {
                instancePath: instancePath + "/columnDefault",
                parentData: data,
                parentDataProperty: "columnDefault",
                rootData
            }))) {
                vErrors = vErrors === null ? validate113.errors : vErrors.concat(validate113.errors);
                errors = vErrors.length;
            }
        }
        if (data.columnCount !== undefined) {
            let data3 = data.columnCount;
            if (!(((typeof data3 == "number") && (!(data3 % 1) && !isNaN(data3))) && (isFinite(data3)))) {
                const err3 = {
                    instancePath: instancePath + "/columnCount",
                    schemaPath: "#/properties/columnCount/type",
                    keyword: "type",
                    params: {
                        type: "integer"
                    },
                    message: "must be integer"
                };
                if (vErrors === null) {
                    vErrors = [err3];
                }
                else {
                    vErrors.push(err3);
                }
                errors++;
            }
            if ((typeof data3 == "number") && (isFinite(data3))) {
                if (data3 < 1 || isNaN(data3)) {
                    const err4 = {
                        instancePath: instancePath + "/columnCount",
                        schemaPath: "#/properties/columnCount/minimum",
                        keyword: "minimum",
                        params: {
                            comparison: ">=",
                            limit: 1
                        },
                        message: "must be >= 1"
                    };
                    if (vErrors === null) {
                        vErrors = [err4];
                    }
                    else {
                        vErrors.push(err4);
                    }
                    errors++;
                }
            }
        }
        if (data.drawVerticalLine !== undefined) {
            if (typeof data.drawVerticalLine != "function") {
                const err5 = {
                    instancePath: instancePath + "/drawVerticalLine",
                    schemaPath: "#/properties/drawVerticalLine/typeof",
                    keyword: "typeof",
                    params: {},
                    message: "must pass \"typeof\" keyword validation"
                };
                if (vErrors === null) {
                    vErrors = [err5];
                }
                else {
                    vErrors.push(err5);
                }
                errors++;
            }
        }
    }
    else {
        const err6 = {
            instancePath,
            schemaPath: "#/type",
            keyword: "type",
            params: {
                type: "object"
            },
            message: "must be object"
        };
        if (vErrors === null) {
            vErrors = [err6];
        }
        else {
            vErrors.push(err6);
        }
        errors++;
    }
    validate86.errors = vErrors;
    return errors === 0;
}
//# sourceMappingURL=validators.js.map

/***/ }),

/***/ 5966:
/***/ ((__unused_webpack_module, exports) => {


/* eslint-disable sort-keys-fix/sort-keys-fix */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getBorderCharacters = void 0;
const getBorderCharacters = (name) => {
    if (name === 'honeywell') {
        return {
            topBody: '═',
            topJoin: '╤',
            topLeft: '╔',
            topRight: '╗',
            bottomBody: '═',
            bottomJoin: '╧',
            bottomLeft: '╚',
            bottomRight: '╝',
            bodyLeft: '║',
            bodyRight: '║',
            bodyJoin: '│',
            headerJoin: '┬',
            joinBody: '─',
            joinLeft: '╟',
            joinRight: '╢',
            joinJoin: '┼',
            joinMiddleDown: '┬',
            joinMiddleUp: '┴',
            joinMiddleLeft: '┤',
            joinMiddleRight: '├',
        };
    }
    if (name === 'norc') {
        return {
            topBody: '─',
            topJoin: '┬',
            topLeft: '┌',
            topRight: '┐',
            bottomBody: '─',
            bottomJoin: '┴',
            bottomLeft: '└',
            bottomRight: '┘',
            bodyLeft: '│',
            bodyRight: '│',
            bodyJoin: '│',
            headerJoin: '┬',
            joinBody: '─',
            joinLeft: '├',
            joinRight: '┤',
            joinJoin: '┼',
            joinMiddleDown: '┬',
            joinMiddleUp: '┴',
            joinMiddleLeft: '┤',
            joinMiddleRight: '├',
        };
    }
    if (name === 'ramac') {
        return {
            topBody: '-',
            topJoin: '+',
            topLeft: '+',
            topRight: '+',
            bottomBody: '-',
            bottomJoin: '+',
            bottomLeft: '+',
            bottomRight: '+',
            bodyLeft: '|',
            bodyRight: '|',
            bodyJoin: '|',
            headerJoin: '+',
            joinBody: '-',
            joinLeft: '|',
            joinRight: '|',
            joinJoin: '|',
            joinMiddleDown: '+',
            joinMiddleUp: '+',
            joinMiddleLeft: '+',
            joinMiddleRight: '+',
        };
    }
    if (name === 'void') {
        return {
            topBody: '',
            topJoin: '',
            topLeft: '',
            topRight: '',
            bottomBody: '',
            bottomJoin: '',
            bottomLeft: '',
            bottomRight: '',
            bodyLeft: '',
            bodyRight: '',
            bodyJoin: '',
            headerJoin: '',
            joinBody: '',
            joinLeft: '',
            joinRight: '',
            joinJoin: '',
            joinMiddleDown: '',
            joinMiddleUp: '',
            joinMiddleLeft: '',
            joinMiddleRight: '',
        };
    }
    throw new Error('Unknown border template "' + name + '".');
};
exports.getBorderCharacters = getBorderCharacters;
//# sourceMappingURL=getBorderCharacters.js.map

/***/ }),

/***/ 4112:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getBorderCharacters = exports.createStream = exports.table = void 0;
const createStream_1 = __nccwpck_require__(6334);
Object.defineProperty(exports, "createStream", ({ enumerable: true, get: function () { return createStream_1.createStream; } }));
const getBorderCharacters_1 = __nccwpck_require__(5966);
Object.defineProperty(exports, "getBorderCharacters", ({ enumerable: true, get: function () { return getBorderCharacters_1.getBorderCharacters; } }));
const table_1 = __nccwpck_require__(4700);
Object.defineProperty(exports, "table", ({ enumerable: true, get: function () { return table_1.table; } }));
__exportStar(__nccwpck_require__(1782), exports);
//# sourceMappingURL=index.js.map

/***/ }),

/***/ 1128:
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.injectHeaderConfig = void 0;
const injectHeaderConfig = (rows, config) => {
    var _a;
    let spanningCellConfig = (_a = config.spanningCells) !== null && _a !== void 0 ? _a : [];
    const headerConfig = config.header;
    const adjustedRows = [...rows];
    if (headerConfig) {
        spanningCellConfig = spanningCellConfig.map(({ row, ...rest }) => {
            return { ...rest,
                row: row + 1 };
        });
        const { content, ...headerStyles } = headerConfig;
        spanningCellConfig.unshift({ alignment: 'center',
            col: 0,
            colSpan: rows[0].length,
            paddingLeft: 1,
            paddingRight: 1,
            row: 0,
            wrapWord: false,
            ...headerStyles });
        adjustedRows.unshift([content, ...Array.from({ length: rows[0].length - 1 }).fill('')]);
    }
    return [adjustedRows,
        spanningCellConfig];
};
exports.injectHeaderConfig = injectHeaderConfig;
//# sourceMappingURL=injectHeaderConfig.js.map

/***/ }),

/***/ 261:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.makeRangeConfig = void 0;
const utils_1 = __nccwpck_require__(1497);
const makeRangeConfig = (spanningCellConfig, columnsConfig) => {
    var _a;
    const { topLeft, bottomRight } = (0, utils_1.calculateRangeCoordinate)(spanningCellConfig);
    const cellConfig = {
        ...columnsConfig[topLeft.col],
        ...spanningCellConfig,
        paddingRight: (_a = spanningCellConfig.paddingRight) !== null && _a !== void 0 ? _a : columnsConfig[bottomRight.col].paddingRight,
    };
    return { ...cellConfig,
        bottomRight,
        topLeft };
};
exports.makeRangeConfig = makeRangeConfig;
//# sourceMappingURL=makeRangeConfig.js.map

/***/ }),

/***/ 7366:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.makeStreamConfig = void 0;
const utils_1 = __nccwpck_require__(1497);
const validateConfig_1 = __nccwpck_require__(2474);
/**
 * Creates a configuration for every column using default
 * values for the missing configuration properties.
 */
const makeColumnsConfig = (columnCount, columns = {}, columnDefault) => {
    return Array.from({ length: columnCount }).map((_, index) => {
        return {
            alignment: 'left',
            paddingLeft: 1,
            paddingRight: 1,
            truncate: Number.POSITIVE_INFINITY,
            verticalAlignment: 'top',
            wrapWord: false,
            ...columnDefault,
            ...columns[index],
        };
    });
};
/**
 * Makes a new configuration object out of the userConfig object
 * using default values for the missing configuration properties.
 */
const makeStreamConfig = (config) => {
    (0, validateConfig_1.validateConfig)('streamConfig.json', config);
    if (config.columnDefault.width === undefined) {
        throw new Error('Must provide config.columnDefault.width when creating a stream.');
    }
    return {
        drawVerticalLine: () => {
            return true;
        },
        ...config,
        border: (0, utils_1.makeBorderConfig)(config.border),
        columns: makeColumnsConfig(config.columnCount, config.columns, config.columnDefault),
    };
};
exports.makeStreamConfig = makeStreamConfig;
//# sourceMappingURL=makeStreamConfig.js.map

/***/ }),

/***/ 5576:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.makeTableConfig = void 0;
const calculateMaximumColumnWidths_1 = __nccwpck_require__(67);
const spanningCellManager_1 = __nccwpck_require__(8705);
const utils_1 = __nccwpck_require__(1497);
const validateConfig_1 = __nccwpck_require__(2474);
const validateSpanningCellConfig_1 = __nccwpck_require__(5252);
/**
 * Creates a configuration for every column using default
 * values for the missing configuration properties.
 */
const makeColumnsConfig = (rows, columns, columnDefault, spanningCellConfigs) => {
    const columnWidths = (0, calculateMaximumColumnWidths_1.calculateMaximumColumnWidths)(rows, spanningCellConfigs);
    return rows[0].map((_, columnIndex) => {
        return {
            alignment: 'left',
            paddingLeft: 1,
            paddingRight: 1,
            truncate: Number.POSITIVE_INFINITY,
            verticalAlignment: 'top',
            width: columnWidths[columnIndex],
            wrapWord: false,
            ...columnDefault,
            ...columns === null || columns === void 0 ? void 0 : columns[columnIndex],
        };
    });
};
/**
 * Makes a new configuration object out of the userConfig object
 * using default values for the missing configuration properties.
 */
const makeTableConfig = (rows, config = {}, injectedSpanningCellConfig) => {
    var _a, _b, _c, _d, _e;
    (0, validateConfig_1.validateConfig)('config.json', config);
    (0, validateSpanningCellConfig_1.validateSpanningCellConfig)(rows, (_a = config.spanningCells) !== null && _a !== void 0 ? _a : []);
    const spanningCellConfigs = (_b = injectedSpanningCellConfig !== null && injectedSpanningCellConfig !== void 0 ? injectedSpanningCellConfig : config.spanningCells) !== null && _b !== void 0 ? _b : [];
    const columnsConfig = makeColumnsConfig(rows, config.columns, config.columnDefault, spanningCellConfigs);
    const drawVerticalLine = (_c = config.drawVerticalLine) !== null && _c !== void 0 ? _c : (() => {
        return true;
    });
    const drawHorizontalLine = (_d = config.drawHorizontalLine) !== null && _d !== void 0 ? _d : (() => {
        return true;
    });
    return {
        ...config,
        border: (0, utils_1.makeBorderConfig)(config.border),
        columns: columnsConfig,
        drawHorizontalLine,
        drawVerticalLine,
        singleLine: (_e = config.singleLine) !== null && _e !== void 0 ? _e : false,
        spanningCellManager: (0, spanningCellManager_1.createSpanningCellManager)({
            columnsConfig,
            drawHorizontalLine,
            drawVerticalLine,
            rows,
            spanningCellConfigs,
        }),
    };
};
exports.makeTableConfig = makeTableConfig;
//# sourceMappingURL=makeTableConfig.js.map

/***/ }),

/***/ 8188:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.mapDataUsingRowHeights = exports.padCellVertically = void 0;
const utils_1 = __nccwpck_require__(1497);
const wrapCell_1 = __nccwpck_require__(8966);
const createEmptyStrings = (length) => {
    return new Array(length).fill('');
};
const padCellVertically = (lines, rowHeight, verticalAlignment) => {
    const availableLines = rowHeight - lines.length;
    if (verticalAlignment === 'top') {
        return [...lines, ...createEmptyStrings(availableLines)];
    }
    if (verticalAlignment === 'bottom') {
        return [...createEmptyStrings(availableLines), ...lines];
    }
    return [
        ...createEmptyStrings(Math.floor(availableLines / 2)),
        ...lines,
        ...createEmptyStrings(Math.ceil(availableLines / 2)),
    ];
};
exports.padCellVertically = padCellVertically;
const mapDataUsingRowHeights = (unmappedRows, rowHeights, config) => {
    const nColumns = unmappedRows[0].length;
    const mappedRows = unmappedRows.map((unmappedRow, unmappedRowIndex) => {
        const outputRowHeight = rowHeights[unmappedRowIndex];
        const outputRow = Array.from({ length: outputRowHeight }, () => {
            return new Array(nColumns).fill('');
        });
        unmappedRow.forEach((cell, cellIndex) => {
            var _a;
            const containingRange = (_a = config.spanningCellManager) === null || _a === void 0 ? void 0 : _a.getContainingRange({ col: cellIndex,
                row: unmappedRowIndex });
            if (containingRange) {
                containingRange.extractCellContent(unmappedRowIndex).forEach((cellLine, cellLineIndex) => {
                    outputRow[cellLineIndex][cellIndex] = cellLine;
                });
                return;
            }
            const cellLines = (0, wrapCell_1.wrapCell)(cell, config.columns[cellIndex].width, config.columns[cellIndex].wrapWord);
            const paddedCellLines = (0, exports.padCellVertically)(cellLines, outputRowHeight, config.columns[cellIndex].verticalAlignment);
            paddedCellLines.forEach((cellLine, cellLineIndex) => {
                outputRow[cellLineIndex][cellIndex] = cellLine;
            });
        });
        return outputRow;
    });
    return (0, utils_1.flatten)(mappedRows);
};
exports.mapDataUsingRowHeights = mapDataUsingRowHeights;
//# sourceMappingURL=mapDataUsingRowHeights.js.map

/***/ }),

/***/ 8649:
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.padTableData = exports.padString = void 0;
const padString = (input, paddingLeft, paddingRight) => {
    return ' '.repeat(paddingLeft) + input + ' '.repeat(paddingRight);
};
exports.padString = padString;
const padTableData = (rows, config) => {
    return rows.map((cells, rowIndex) => {
        return cells.map((cell, cellIndex) => {
            var _a;
            const containingRange = (_a = config.spanningCellManager) === null || _a === void 0 ? void 0 : _a.getContainingRange({ col: cellIndex,
                row: rowIndex }, { mapped: true });
            if (containingRange) {
                return cell;
            }
            const { paddingLeft, paddingRight } = config.columns[cellIndex];
            return (0, exports.padString)(cell, paddingLeft, paddingRight);
        });
    });
};
exports.padTableData = padTableData;
//# sourceMappingURL=padTableData.js.map

/***/ }),

/***/ 8705:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.createSpanningCellManager = void 0;
const alignSpanningCell_1 = __nccwpck_require__(2651);
const calculateSpanningCellWidth_1 = __nccwpck_require__(888);
const makeRangeConfig_1 = __nccwpck_require__(261);
const utils_1 = __nccwpck_require__(1497);
const findRangeConfig = (cell, rangeConfigs) => {
    return rangeConfigs.find((rangeCoordinate) => {
        return (0, utils_1.isCellInRange)(cell, rangeCoordinate);
    });
};
const getContainingRange = (rangeConfig, context) => {
    const width = (0, calculateSpanningCellWidth_1.calculateSpanningCellWidth)(rangeConfig, context);
    const wrappedContent = (0, alignSpanningCell_1.wrapRangeContent)(rangeConfig, width, context);
    const alignedContent = (0, alignSpanningCell_1.alignVerticalRangeContent)(rangeConfig, wrappedContent, context);
    const getCellContent = (rowIndex) => {
        const { topLeft } = rangeConfig;
        const { drawHorizontalLine, rowHeights } = context;
        const totalWithinHorizontalBorderHeight = rowIndex - topLeft.row;
        const totalHiddenHorizontalBorderHeight = (0, utils_1.sequence)(topLeft.row + 1, rowIndex).filter((index) => {
            /* istanbul ignore next */
            return !(drawHorizontalLine === null || drawHorizontalLine === void 0 ? void 0 : drawHorizontalLine(index, rowHeights.length));
        }).length;
        const offset = (0, utils_1.sumArray)(rowHeights.slice(topLeft.row, rowIndex)) + totalWithinHorizontalBorderHeight - totalHiddenHorizontalBorderHeight;
        return alignedContent.slice(offset, offset + rowHeights[rowIndex]);
    };
    const getBorderContent = (borderIndex) => {
        const { topLeft } = rangeConfig;
        const offset = (0, utils_1.sumArray)(context.rowHeights.slice(topLeft.row, borderIndex)) + (borderIndex - topLeft.row - 1);
        return alignedContent[offset];
    };
    return {
        ...rangeConfig,
        extractBorderContent: getBorderContent,
        extractCellContent: getCellContent,
        height: wrappedContent.length,
        width,
    };
};
const inSameRange = (cell1, cell2, ranges) => {
    const range1 = findRangeConfig(cell1, ranges);
    const range2 = findRangeConfig(cell2, ranges);
    if (range1 && range2) {
        return (0, utils_1.areCellEqual)(range1.topLeft, range2.topLeft);
    }
    return false;
};
const hashRange = (range) => {
    const { row, col } = range.topLeft;
    return `${row}/${col}`;
};
const createSpanningCellManager = (parameters) => {
    const { spanningCellConfigs, columnsConfig } = parameters;
    const ranges = spanningCellConfigs.map((config) => {
        return (0, makeRangeConfig_1.makeRangeConfig)(config, columnsConfig);
    });
    const rangeCache = {};
    let rowHeights = [];
    let rowIndexMapping = [];
    return { getContainingRange: (cell, options) => {
            var _a;
            const originalRow = (options === null || options === void 0 ? void 0 : options.mapped) ? rowIndexMapping[cell.row] : cell.row;
            const range = findRangeConfig({ ...cell,
                row: originalRow }, ranges);
            if (!range) {
                return undefined;
            }
            if (rowHeights.length === 0) {
                return getContainingRange(range, { ...parameters,
                    rowHeights });
            }
            const hash = hashRange(range);
            (_a = rangeCache[hash]) !== null && _a !== void 0 ? _a : (rangeCache[hash] = getContainingRange(range, { ...parameters,
                rowHeights }));
            return rangeCache[hash];
        },
        inSameRange: (cell1, cell2) => {
            return inSameRange(cell1, cell2, ranges);
        },
        rowHeights,
        rowIndexMapping,
        setRowHeights: (_rowHeights) => {
            rowHeights = _rowHeights;
        },
        setRowIndexMapping: (mappedRowHeights) => {
            rowIndexMapping = (0, utils_1.flatten)(mappedRowHeights.map((height, index) => {
                return Array.from({ length: height }, () => {
                    return index;
                });
            }));
        } };
};
exports.createSpanningCellManager = createSpanningCellManager;
//# sourceMappingURL=spanningCellManager.js.map

/***/ }),

/***/ 3337:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.stringifyTableData = void 0;
const utils_1 = __nccwpck_require__(1497);
const stringifyTableData = (rows) => {
    return rows.map((cells) => {
        return cells.map((cell) => {
            return (0, utils_1.normalizeString)(String(cell));
        });
    });
};
exports.stringifyTableData = stringifyTableData;
//# sourceMappingURL=stringifyTableData.js.map

/***/ }),

/***/ 4700:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.table = void 0;
const alignTableData_1 = __nccwpck_require__(7061);
const calculateOutputColumnWidths_1 = __nccwpck_require__(6246);
const calculateRowHeights_1 = __nccwpck_require__(2696);
const drawTable_1 = __nccwpck_require__(7910);
const injectHeaderConfig_1 = __nccwpck_require__(1128);
const makeTableConfig_1 = __nccwpck_require__(5576);
const mapDataUsingRowHeights_1 = __nccwpck_require__(8188);
const padTableData_1 = __nccwpck_require__(8649);
const stringifyTableData_1 = __nccwpck_require__(3337);
const truncateTableData_1 = __nccwpck_require__(4042);
const utils_1 = __nccwpck_require__(1497);
const validateTableData_1 = __nccwpck_require__(8310);
const table = (data, userConfig = {}) => {
    (0, validateTableData_1.validateTableData)(data);
    let rows = (0, stringifyTableData_1.stringifyTableData)(data);
    const [injectedRows, injectedSpanningCellConfig] = (0, injectHeaderConfig_1.injectHeaderConfig)(rows, userConfig);
    const config = (0, makeTableConfig_1.makeTableConfig)(injectedRows, userConfig, injectedSpanningCellConfig);
    rows = (0, truncateTableData_1.truncateTableData)(injectedRows, (0, utils_1.extractTruncates)(config));
    const rowHeights = (0, calculateRowHeights_1.calculateRowHeights)(rows, config);
    config.spanningCellManager.setRowHeights(rowHeights);
    config.spanningCellManager.setRowIndexMapping(rowHeights);
    rows = (0, mapDataUsingRowHeights_1.mapDataUsingRowHeights)(rows, rowHeights, config);
    rows = (0, alignTableData_1.alignTableData)(rows, config);
    rows = (0, padTableData_1.padTableData)(rows, config);
    const outputColumnWidths = (0, calculateOutputColumnWidths_1.calculateOutputColumnWidths)(config);
    return (0, drawTable_1.drawTable)(rows, outputColumnWidths, rowHeights, config);
};
exports.table = table;
//# sourceMappingURL=table.js.map

/***/ }),

/***/ 4042:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.truncateTableData = exports.truncateString = void 0;
const lodash_truncate_1 = __importDefault(__nccwpck_require__(4055));
const truncateString = (input, length) => {
    return (0, lodash_truncate_1.default)(input, { length,
        omission: '…' });
};
exports.truncateString = truncateString;
/**
 * @todo Make it work with ASCII content.
 */
const truncateTableData = (rows, truncates) => {
    return rows.map((cells) => {
        return cells.map((cell, cellIndex) => {
            return (0, exports.truncateString)(cell, truncates[cellIndex]);
        });
    });
};
exports.truncateTableData = truncateTableData;
//# sourceMappingURL=truncateTableData.js.map

/***/ }),

/***/ 1782:
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
//# sourceMappingURL=api.js.map

/***/ }),

/***/ 1497:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.isCellInRange = exports.areCellEqual = exports.calculateRangeCoordinate = exports.flatten = exports.extractTruncates = exports.sumArray = exports.sequence = exports.distributeUnevenly = exports.countSpaceSequence = exports.groupBySizes = exports.makeBorderConfig = exports.splitAnsi = exports.normalizeString = void 0;
const slice_ansi_1 = __importDefault(__nccwpck_require__(3298));
const string_width_1 = __importDefault(__nccwpck_require__(7492));
const strip_ansi_1 = __importDefault(__nccwpck_require__(3958));
const getBorderCharacters_1 = __nccwpck_require__(5966);
/**
 * Converts Windows-style newline to Unix-style
 *
 * @internal
 */
const normalizeString = (input) => {
    return input.replace(/\r\n/g, '\n');
};
exports.normalizeString = normalizeString;
/**
 * Splits ansi string by newlines
 *
 * @internal
 */
const splitAnsi = (input) => {
    const lengths = (0, strip_ansi_1.default)(input).split('\n').map(string_width_1.default);
    const result = [];
    let startIndex = 0;
    lengths.forEach((length) => {
        result.push(length === 0 ? '' : (0, slice_ansi_1.default)(input, startIndex, startIndex + length));
        // Plus 1 for the newline character itself
        startIndex += length + 1;
    });
    return result;
};
exports.splitAnsi = splitAnsi;
/**
 * Merges user provided border characters with the default border ("honeywell") characters.
 *
 * @internal
 */
const makeBorderConfig = (border) => {
    return {
        ...(0, getBorderCharacters_1.getBorderCharacters)('honeywell'),
        ...border,
    };
};
exports.makeBorderConfig = makeBorderConfig;
/**
 * Groups the array into sub-arrays by sizes.
 *
 * @internal
 * @example
 * groupBySizes(['a', 'b', 'c', 'd', 'e'], [2, 1, 2]) = [ ['a', 'b'], ['c'], ['d', 'e'] ]
 */
const groupBySizes = (array, sizes) => {
    let startIndex = 0;
    return sizes.map((size) => {
        const group = array.slice(startIndex, startIndex + size);
        startIndex += size;
        return group;
    });
};
exports.groupBySizes = groupBySizes;
/**
 * Counts the number of continuous spaces in a string
 *
 * @internal
 * @example
 * countGroupSpaces('a  bc  de f') = 3
 */
const countSpaceSequence = (input) => {
    var _a, _b;
    return (_b = (_a = input.match(/\s+/g)) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
};
exports.countSpaceSequence = countSpaceSequence;
/**
 * Creates the non-increasing number array given sum and length
 * whose the difference between maximum and minimum is not greater than 1
 *
 * @internal
 * @example
 * distributeUnevenly(6, 3) = [2, 2, 2]
 * distributeUnevenly(8, 3) = [3, 3, 2]
 */
const distributeUnevenly = (sum, length) => {
    const result = Array.from({ length }).fill(Math.floor(sum / length));
    return result.map((element, index) => {
        return element + (index < sum % length ? 1 : 0);
    });
};
exports.distributeUnevenly = distributeUnevenly;
const sequence = (start, end) => {
    return Array.from({ length: end - start + 1 }, (_, index) => {
        return index + start;
    });
};
exports.sequence = sequence;
const sumArray = (array) => {
    return array.reduce((accumulator, element) => {
        return accumulator + element;
    }, 0);
};
exports.sumArray = sumArray;
const extractTruncates = (config) => {
    return config.columns.map(({ truncate }) => {
        return truncate;
    });
};
exports.extractTruncates = extractTruncates;
const flatten = (array) => {
    return [].concat(...array);
};
exports.flatten = flatten;
const calculateRangeCoordinate = (spanningCellConfig) => {
    const { row, col, colSpan = 1, rowSpan = 1 } = spanningCellConfig;
    return { bottomRight: { col: col + colSpan - 1,
            row: row + rowSpan - 1 },
        topLeft: { col,
            row } };
};
exports.calculateRangeCoordinate = calculateRangeCoordinate;
const areCellEqual = (cell1, cell2) => {
    return cell1.row === cell2.row && cell1.col === cell2.col;
};
exports.areCellEqual = areCellEqual;
const isCellInRange = (cell, { topLeft, bottomRight }) => {
    return (topLeft.row <= cell.row &&
        cell.row <= bottomRight.row &&
        topLeft.col <= cell.col &&
        cell.col <= bottomRight.col);
};
exports.isCellInRange = isCellInRange;
//# sourceMappingURL=utils.js.map

/***/ }),

/***/ 2474:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.validateConfig = void 0;
const validators_1 = __importDefault(__nccwpck_require__(1423));
const validateConfig = (schemaId, config) => {
    const validate = validators_1.default[schemaId];
    if (!validate(config) && validate.errors) {
        // eslint-disable-next-line promise/prefer-await-to-callbacks
        const errors = validate.errors.map((error) => {
            return {
                message: error.message,
                params: error.params,
                schemaPath: error.schemaPath,
            };
        });
        /* eslint-disable no-console */
        console.log('config', config);
        console.log('errors', errors);
        /* eslint-enable no-console */
        throw new Error('Invalid config.');
    }
};
exports.validateConfig = validateConfig;
//# sourceMappingURL=validateConfig.js.map

/***/ }),

/***/ 5252:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.validateSpanningCellConfig = void 0;
const utils_1 = __nccwpck_require__(1497);
const inRange = (start, end, value) => {
    return start <= value && value <= end;
};
const validateSpanningCellConfig = (rows, configs) => {
    const [nRow, nCol] = [rows.length, rows[0].length];
    configs.forEach((config, configIndex) => {
        const { colSpan, rowSpan } = config;
        if (colSpan === undefined && rowSpan === undefined) {
            throw new Error(`Expect at least colSpan or rowSpan is provided in config.spanningCells[${configIndex}]`);
        }
        if (colSpan !== undefined && colSpan < 1) {
            throw new Error(`Expect colSpan is not equal zero, instead got: ${colSpan} in config.spanningCells[${configIndex}]`);
        }
        if (rowSpan !== undefined && rowSpan < 1) {
            throw new Error(`Expect rowSpan is not equal zero, instead got: ${rowSpan} in config.spanningCells[${configIndex}]`);
        }
    });
    const rangeCoordinates = configs.map(utils_1.calculateRangeCoordinate);
    rangeCoordinates.forEach(({ topLeft, bottomRight }, rangeIndex) => {
        if (!inRange(0, nCol - 1, topLeft.col) ||
            !inRange(0, nRow - 1, topLeft.row) ||
            !inRange(0, nCol - 1, bottomRight.col) ||
            !inRange(0, nRow - 1, bottomRight.row)) {
            throw new Error(`Some cells in config.spanningCells[${rangeIndex}] are out of the table`);
        }
    });
    const configOccupy = Array.from({ length: nRow }, () => {
        return Array.from({ length: nCol });
    });
    rangeCoordinates.forEach(({ topLeft, bottomRight }, rangeIndex) => {
        (0, utils_1.sequence)(topLeft.row, bottomRight.row).forEach((row) => {
            (0, utils_1.sequence)(topLeft.col, bottomRight.col).forEach((col) => {
                if (configOccupy[row][col] !== undefined) {
                    throw new Error(`Spanning cells in config.spanningCells[${configOccupy[row][col]}] and config.spanningCells[${rangeIndex}] are overlap each other`);
                }
                configOccupy[row][col] = rangeIndex;
            });
        });
    });
};
exports.validateSpanningCellConfig = validateSpanningCellConfig;
//# sourceMappingURL=validateSpanningCellConfig.js.map

/***/ }),

/***/ 8310:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.validateTableData = void 0;
const utils_1 = __nccwpck_require__(1497);
const validateTableData = (rows) => {
    if (!Array.isArray(rows)) {
        throw new TypeError('Table data must be an array.');
    }
    if (rows.length === 0) {
        throw new Error('Table must define at least one row.');
    }
    if (rows[0].length === 0) {
        throw new Error('Table must define at least one column.');
    }
    const columnNumber = rows[0].length;
    for (const row of rows) {
        if (!Array.isArray(row)) {
            throw new TypeError('Table row data must be an array.');
        }
        if (row.length !== columnNumber) {
            throw new Error('Table must have a consistent number of cells.');
        }
        for (const cell of row) {
            // eslint-disable-next-line no-control-regex
            if (/[\u0001-\u0006\u0008\u0009\u000B-\u001A]/.test((0, utils_1.normalizeString)(String(cell)))) {
                throw new Error('Table data must not contain control characters.');
            }
        }
    }
};
exports.validateTableData = validateTableData;
//# sourceMappingURL=validateTableData.js.map

/***/ }),

/***/ 8966:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.wrapCell = void 0;
const utils_1 = __nccwpck_require__(1497);
const wrapString_1 = __nccwpck_require__(9063);
const wrapWord_1 = __nccwpck_require__(3646);
/**
 * Wrap a single cell value into a list of lines
 *
 * Always wraps on newlines, for the remainder uses either word or string wrapping
 * depending on user configuration.
 *
 */
const wrapCell = (cellValue, cellWidth, useWrapWord) => {
    // First split on literal newlines
    const cellLines = (0, utils_1.splitAnsi)(cellValue);
    // Then iterate over the list and word-wrap every remaining line if necessary.
    for (let lineNr = 0; lineNr < cellLines.length;) {
        let lineChunks;
        if (useWrapWord) {
            lineChunks = (0, wrapWord_1.wrapWord)(cellLines[lineNr], cellWidth);
        }
        else {
            lineChunks = (0, wrapString_1.wrapString)(cellLines[lineNr], cellWidth);
        }
        // Replace our original array element with whatever the wrapping returned
        cellLines.splice(lineNr, 1, ...lineChunks);
        lineNr += lineChunks.length;
    }
    return cellLines;
};
exports.wrapCell = wrapCell;
//# sourceMappingURL=wrapCell.js.map

/***/ }),

/***/ 9063:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.wrapString = void 0;
const slice_ansi_1 = __importDefault(__nccwpck_require__(3298));
const string_width_1 = __importDefault(__nccwpck_require__(7492));
/**
 * Creates an array of strings split into groups the length of size.
 * This function works with strings that contain ASCII characters.
 *
 * wrapText is different from would-be "chunk" implementation
 * in that whitespace characters that occur on a chunk size limit are trimmed.
 *
 */
const wrapString = (subject, size) => {
    let subjectSlice = subject;
    const chunks = [];
    do {
        chunks.push((0, slice_ansi_1.default)(subjectSlice, 0, size));
        subjectSlice = (0, slice_ansi_1.default)(subjectSlice, size).trim();
    } while ((0, string_width_1.default)(subjectSlice));
    return chunks;
};
exports.wrapString = wrapString;
//# sourceMappingURL=wrapString.js.map

/***/ }),

/***/ 3646:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.wrapWord = void 0;
const slice_ansi_1 = __importDefault(__nccwpck_require__(3298));
const strip_ansi_1 = __importDefault(__nccwpck_require__(3958));
const calculateStringLengths = (input, size) => {
    let subject = (0, strip_ansi_1.default)(input);
    const chunks = [];
    // https://regex101.com/r/gY5kZ1/1
    const re = new RegExp('(^.{1,' + String(Math.max(size, 1)) + '}(\\s+|$))|(^.{1,' + String(Math.max(size - 1, 1)) + '}(\\\\|/|_|\\.|,|;|-))');
    do {
        let chunk;
        const match = re.exec(subject);
        if (match) {
            chunk = match[0];
            subject = subject.slice(chunk.length);
            const trimmedLength = chunk.trim().length;
            const offset = chunk.length - trimmedLength;
            chunks.push([trimmedLength, offset]);
        }
        else {
            chunk = subject.slice(0, size);
            subject = subject.slice(size);
            chunks.push([chunk.length, 0]);
        }
    } while (subject.length);
    return chunks;
};
const wrapWord = (input, size) => {
    const result = [];
    let startIndex = 0;
    calculateStringLengths(input, size).forEach(([length, offset]) => {
        result.push((0, slice_ansi_1.default)(input, startIndex, startIndex + length));
        startIndex += length + offset;
    });
    return result;
};
exports.wrapWord = wrapWord;
//# sourceMappingURL=wrapWord.js.map

/***/ }),

/***/ 3855:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
// https://github.com/ajv-validator/ajv/issues/889
const equal = __nccwpck_require__(3430);
equal.code = 'require("ajv/dist/runtime/equal").default';
exports.A = equal;
//# sourceMappingURL=equal.js.map

/***/ }),

/***/ 7492:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {


const stripAnsi = __nccwpck_require__(3958);
const isFullwidthCodePoint = __nccwpck_require__(4519);
const emojiRegex = __nccwpck_require__(872);

const stringWidth = string => {
	if (typeof string !== 'string' || string.length === 0) {
		return 0;
	}

	string = stripAnsi(string);

	if (string.length === 0) {
		return 0;
	}

	string = string.replace(emojiRegex(), '  ');

	let width = 0;

	for (let i = 0; i < string.length; i++) {
		const code = string.codePointAt(i);

		// Ignore control characters
		if (code <= 0x1F || (code >= 0x7F && code <= 0x9F)) {
			continue;
		}

		// Ignore combining characters
		if (code >= 0x300 && code <= 0x36F) {
			continue;
		}

		// Surrogates
		if (code > 0xFFFF) {
			i++;
		}

		width += isFullwidthCodePoint(code) ? 2 : 1;
	}

	return width;
};

module.exports = stringWidth;
// TODO: remove this in the next major version
module.exports["default"] = stringWidth;


/***/ }),

/***/ 181:
/***/ ((module) => {

module.exports = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("buffer");

/***/ }),

/***/ 932:
/***/ ((module) => {

module.exports = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("process");

/***/ }),

/***/ 7349:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var identity = __nccwpck_require__(1127);
var Scalar = __nccwpck_require__(3301);
var YAMLMap = __nccwpck_require__(4454);
var YAMLSeq = __nccwpck_require__(2223);
var resolveBlockMap = __nccwpck_require__(7103);
var resolveBlockSeq = __nccwpck_require__(334);
var resolveFlowCollection = __nccwpck_require__(3142);

function resolveCollection(CN, ctx, token, onError, tagName, tag) {
    const coll = token.type === 'block-map'
        ? resolveBlockMap.resolveBlockMap(CN, ctx, token, onError, tag)
        : token.type === 'block-seq'
            ? resolveBlockSeq.resolveBlockSeq(CN, ctx, token, onError, tag)
            : resolveFlowCollection.resolveFlowCollection(CN, ctx, token, onError, tag);
    const Coll = coll.constructor;
    // If we got a tagName matching the class, or the tag name is '!',
    // then use the tagName from the node class used to create it.
    if (tagName === '!' || tagName === Coll.tagName) {
        coll.tag = Coll.tagName;
        return coll;
    }
    if (tagName)
        coll.tag = tagName;
    return coll;
}
function composeCollection(CN, ctx, token, props, onError) {
    const tagToken = props.tag;
    const tagName = !tagToken
        ? null
        : ctx.directives.tagName(tagToken.source, msg => onError(tagToken, 'TAG_RESOLVE_FAILED', msg));
    if (token.type === 'block-seq') {
        const { anchor, newlineAfterProp: nl } = props;
        const lastProp = anchor && tagToken
            ? anchor.offset > tagToken.offset
                ? anchor
                : tagToken
            : (anchor ?? tagToken);
        if (lastProp && (!nl || nl.offset < lastProp.offset)) {
            const message = 'Missing newline after block sequence props';
            onError(lastProp, 'MISSING_CHAR', message);
        }
    }
    const expType = token.type === 'block-map'
        ? 'map'
        : token.type === 'block-seq'
            ? 'seq'
            : token.start.source === '{'
                ? 'map'
                : 'seq';
    // shortcut: check if it's a generic YAMLMap or YAMLSeq
    // before jumping into the custom tag logic.
    if (!tagToken ||
        !tagName ||
        tagName === '!' ||
        (tagName === YAMLMap.YAMLMap.tagName && expType === 'map') ||
        (tagName === YAMLSeq.YAMLSeq.tagName && expType === 'seq')) {
        return resolveCollection(CN, ctx, token, onError, tagName);
    }
    let tag = ctx.schema.tags.find(t => t.tag === tagName && t.collection === expType);
    if (!tag) {
        const kt = ctx.schema.knownTags[tagName];
        if (kt?.collection === expType) {
            ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
            tag = kt;
        }
        else {
            if (kt) {
                onError(tagToken, 'BAD_COLLECTION_TYPE', `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? 'scalar'}`, true);
            }
            else {
                onError(tagToken, 'TAG_RESOLVE_FAILED', `Unresolved tag: ${tagName}`, true);
            }
            return resolveCollection(CN, ctx, token, onError, tagName);
        }
    }
    const coll = resolveCollection(CN, ctx, token, onError, tagName, tag);
    const res = tag.resolve?.(coll, msg => onError(tagToken, 'TAG_RESOLVE_FAILED', msg), ctx.options) ?? coll;
    const node = identity.isNode(res)
        ? res
        : new Scalar.Scalar(res);
    node.range = coll.range;
    node.tag = tagName;
    if (tag?.format)
        node.format = tag.format;
    return node;
}

exports.composeCollection = composeCollection;


/***/ }),

/***/ 3683:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var Document = __nccwpck_require__(3021);
var composeNode = __nccwpck_require__(5937);
var resolveEnd = __nccwpck_require__(7788);
var resolveProps = __nccwpck_require__(4631);

function composeDoc(options, directives, { offset, start, value, end }, onError) {
    const opts = Object.assign({ _directives: directives }, options);
    const doc = new Document.Document(undefined, opts);
    const ctx = {
        atKey: false,
        atRoot: true,
        directives: doc.directives,
        options: doc.options,
        schema: doc.schema
    };
    const props = resolveProps.resolveProps(start, {
        indicator: 'doc-start',
        next: value ?? end?.[0],
        offset,
        onError,
        parentIndent: 0,
        startOnNewline: true
    });
    if (props.found) {
        doc.directives.docStart = true;
        if (value &&
            (value.type === 'block-map' || value.type === 'block-seq') &&
            !props.hasNewline)
            onError(props.end, 'MISSING_CHAR', 'Block collection cannot start on same line with directives-end marker');
    }
    // @ts-expect-error If Contents is set, let's trust the user
    doc.contents = value
        ? composeNode.composeNode(ctx, value, props, onError)
        : composeNode.composeEmptyNode(ctx, props.end, start, null, props, onError);
    const contentEnd = doc.contents.range[2];
    const re = resolveEnd.resolveEnd(end, contentEnd, false, onError);
    if (re.comment)
        doc.comment = re.comment;
    doc.range = [offset, contentEnd, re.offset];
    return doc;
}

exports.composeDoc = composeDoc;


/***/ }),

/***/ 5937:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var Alias = __nccwpck_require__(4065);
var identity = __nccwpck_require__(1127);
var composeCollection = __nccwpck_require__(7349);
var composeScalar = __nccwpck_require__(5413);
var resolveEnd = __nccwpck_require__(7788);
var utilEmptyScalarPosition = __nccwpck_require__(2599);

const CN = { composeNode, composeEmptyNode };
function composeNode(ctx, token, props, onError) {
    const atKey = ctx.atKey;
    const { spaceBefore, comment, anchor, tag } = props;
    let node;
    let isSrcToken = true;
    switch (token.type) {
        case 'alias':
            node = composeAlias(ctx, token, onError);
            if (anchor || tag)
                onError(token, 'ALIAS_PROPS', 'An alias node must not specify any properties');
            break;
        case 'scalar':
        case 'single-quoted-scalar':
        case 'double-quoted-scalar':
        case 'block-scalar':
            node = composeScalar.composeScalar(ctx, token, tag, onError);
            if (anchor)
                node.anchor = anchor.source.substring(1);
            break;
        case 'block-map':
        case 'block-seq':
        case 'flow-collection':
            try {
                node = composeCollection.composeCollection(CN, ctx, token, props, onError);
                if (anchor)
                    node.anchor = anchor.source.substring(1);
            }
            catch (error) {
                // Almost certainly here due to a stack overflow
                const message = error instanceof Error ? error.message : String(error);
                onError(token, 'RESOURCE_EXHAUSTION', message);
            }
            break;
        default: {
            const message = token.type === 'error'
                ? token.message
                : `Unsupported token (type: ${token.type})`;
            onError(token, 'UNEXPECTED_TOKEN', message);
            isSrcToken = false;
        }
    }
    node ?? (node = composeEmptyNode(ctx, token.offset, undefined, null, props, onError));
    if (anchor && node.anchor === '')
        onError(anchor, 'BAD_ALIAS', 'Anchor cannot be an empty string');
    if (atKey &&
        ctx.options.stringKeys &&
        (!identity.isScalar(node) ||
            typeof node.value !== 'string' ||
            (node.tag && node.tag !== 'tag:yaml.org,2002:str'))) {
        const msg = 'With stringKeys, all keys must be strings';
        onError(tag ?? token, 'NON_STRING_KEY', msg);
    }
    if (spaceBefore)
        node.spaceBefore = true;
    if (comment) {
        if (token.type === 'scalar' && token.source === '')
            node.comment = comment;
        else
            node.commentBefore = comment;
    }
    // @ts-expect-error Type checking misses meaning of isSrcToken
    if (ctx.options.keepSourceTokens && isSrcToken)
        node.srcToken = token;
    return node;
}
function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
    const token = {
        type: 'scalar',
        offset: utilEmptyScalarPosition.emptyScalarPosition(offset, before, pos),
        indent: -1,
        source: ''
    };
    const node = composeScalar.composeScalar(ctx, token, tag, onError);
    if (anchor) {
        node.anchor = anchor.source.substring(1);
        if (node.anchor === '')
            onError(anchor, 'BAD_ALIAS', 'Anchor cannot be an empty string');
    }
    if (spaceBefore)
        node.spaceBefore = true;
    if (comment) {
        node.comment = comment;
        node.range[2] = end;
    }
    return node;
}
function composeAlias({ options }, { offset, source, end }, onError) {
    const alias = new Alias.Alias(source.substring(1));
    if (alias.source === '')
        onError(offset, 'BAD_ALIAS', 'Alias cannot be an empty string');
    if (alias.source.endsWith(':'))
        onError(offset + source.length - 1, 'BAD_ALIAS', 'Alias ending in : is ambiguous', true);
    const valueEnd = offset + source.length;
    const re = resolveEnd.resolveEnd(end, valueEnd, options.strict, onError);
    alias.range = [offset, valueEnd, re.offset];
    if (re.comment)
        alias.comment = re.comment;
    return alias;
}

exports.composeEmptyNode = composeEmptyNode;
exports.composeNode = composeNode;


/***/ }),

/***/ 5413:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var identity = __nccwpck_require__(1127);
var Scalar = __nccwpck_require__(3301);
var resolveBlockScalar = __nccwpck_require__(8913);
var resolveFlowScalar = __nccwpck_require__(6842);

function composeScalar(ctx, token, tagToken, onError) {
    const { value, type, comment, range } = token.type === 'block-scalar'
        ? resolveBlockScalar.resolveBlockScalar(ctx, token, onError)
        : resolveFlowScalar.resolveFlowScalar(token, ctx.options.strict, onError);
    const tagName = tagToken
        ? ctx.directives.tagName(tagToken.source, msg => onError(tagToken, 'TAG_RESOLVE_FAILED', msg))
        : null;
    let tag;
    if (ctx.options.stringKeys && ctx.atKey) {
        tag = ctx.schema[identity.SCALAR];
    }
    else if (tagName)
        tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
    else if (token.type === 'scalar')
        tag = findScalarTagByTest(ctx, value, token, onError);
    else
        tag = ctx.schema[identity.SCALAR];
    let scalar;
    try {
        const res = tag.resolve(value, msg => onError(tagToken ?? token, 'TAG_RESOLVE_FAILED', msg), ctx.options);
        scalar = identity.isScalar(res) ? res : new Scalar.Scalar(res);
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        onError(tagToken ?? token, 'TAG_RESOLVE_FAILED', msg);
        scalar = new Scalar.Scalar(value);
    }
    scalar.range = range;
    scalar.source = value;
    if (type)
        scalar.type = type;
    if (tagName)
        scalar.tag = tagName;
    if (tag.format)
        scalar.format = tag.format;
    if (comment)
        scalar.comment = comment;
    return scalar;
}
function findScalarTagByName(schema, value, tagName, tagToken, onError) {
    if (tagName === '!')
        return schema[identity.SCALAR]; // non-specific tag
    const matchWithTest = [];
    for (const tag of schema.tags) {
        if (!tag.collection && tag.tag === tagName) {
            if (tag.default && tag.test)
                matchWithTest.push(tag);
            else
                return tag;
        }
    }
    for (const tag of matchWithTest)
        if (tag.test?.test(value))
            return tag;
    const kt = schema.knownTags[tagName];
    if (kt && !kt.collection) {
        // Ensure that the known tag is available for stringifying,
        // but does not get used by default.
        schema.tags.push(Object.assign({}, kt, { default: false, test: undefined }));
        return kt;
    }
    onError(tagToken, 'TAG_RESOLVE_FAILED', `Unresolved tag: ${tagName}`, tagName !== 'tag:yaml.org,2002:str');
    return schema[identity.SCALAR];
}
function findScalarTagByTest({ atKey, directives, schema }, value, token, onError) {
    const tag = schema.tags.find(tag => (tag.default === true || (atKey && tag.default === 'key')) &&
        tag.test?.test(value)) || schema[identity.SCALAR];
    if (schema.compat) {
        const compat = schema.compat.find(tag => tag.default && tag.test?.test(value)) ??
            schema[identity.SCALAR];
        if (tag.tag !== compat.tag) {
            const ts = directives.tagString(tag.tag);
            const cs = directives.tagString(compat.tag);
            const msg = `Value may be parsed as either ${ts} or ${cs}`;
            onError(token, 'TAG_RESOLVE_FAILED', msg, true);
        }
    }
    return tag;
}

exports.composeScalar = composeScalar;


/***/ }),

/***/ 9984:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var node_process = __nccwpck_require__(932);
var directives = __nccwpck_require__(1342);
var Document = __nccwpck_require__(3021);
var errors = __nccwpck_require__(1464);
var identity = __nccwpck_require__(1127);
var composeDoc = __nccwpck_require__(3683);
var resolveEnd = __nccwpck_require__(7788);

function getErrorPos(src) {
    if (typeof src === 'number')
        return [src, src + 1];
    if (Array.isArray(src))
        return src.length === 2 ? src : [src[0], src[1]];
    const { offset, source } = src;
    return [offset, offset + (typeof source === 'string' ? source.length : 1)];
}
function parsePrelude(prelude) {
    let comment = '';
    let atComment = false;
    let afterEmptyLine = false;
    for (let i = 0; i < prelude.length; ++i) {
        const source = prelude[i];
        switch (source[0]) {
            case '#':
                comment +=
                    (comment === '' ? '' : afterEmptyLine ? '\n\n' : '\n') +
                        (source.substring(1) || ' ');
                atComment = true;
                afterEmptyLine = false;
                break;
            case '%':
                if (prelude[i + 1]?.[0] !== '#')
                    i += 1;
                atComment = false;
                break;
            default:
                // This may be wrong after doc-end, but in that case it doesn't matter
                if (!atComment)
                    afterEmptyLine = true;
                atComment = false;
        }
    }
    return { comment, afterEmptyLine };
}
/**
 * Compose a stream of CST nodes into a stream of YAML Documents.
 *
 * ```ts
 * import { Composer, Parser } from 'yaml'
 *
 * const src: string = ...
 * const tokens = new Parser().parse(src)
 * const docs = new Composer().compose(tokens)
 * ```
 */
class Composer {
    constructor(options = {}) {
        this.doc = null;
        this.atDirectives = false;
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
        this.onError = (source, code, message, warning) => {
            const pos = getErrorPos(source);
            if (warning)
                this.warnings.push(new errors.YAMLWarning(pos, code, message));
            else
                this.errors.push(new errors.YAMLParseError(pos, code, message));
        };
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        this.directives = new directives.Directives({ version: options.version || '1.2' });
        this.options = options;
    }
    decorate(doc, afterDoc) {
        const { comment, afterEmptyLine } = parsePrelude(this.prelude);
        //console.log({ dc: doc.comment, prelude, comment })
        if (comment) {
            const dc = doc.contents;
            if (afterDoc) {
                doc.comment = doc.comment ? `${doc.comment}\n${comment}` : comment;
            }
            else if (afterEmptyLine || doc.directives.docStart || !dc) {
                doc.commentBefore = comment;
            }
            else if (identity.isCollection(dc) && !dc.flow && dc.items.length > 0) {
                let it = dc.items[0];
                if (identity.isPair(it))
                    it = it.key;
                const cb = it.commentBefore;
                it.commentBefore = cb ? `${comment}\n${cb}` : comment;
            }
            else {
                const cb = dc.commentBefore;
                dc.commentBefore = cb ? `${comment}\n${cb}` : comment;
            }
        }
        if (afterDoc) {
            Array.prototype.push.apply(doc.errors, this.errors);
            Array.prototype.push.apply(doc.warnings, this.warnings);
        }
        else {
            doc.errors = this.errors;
            doc.warnings = this.warnings;
        }
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
    }
    /**
     * Current stream status information.
     *
     * Mostly useful at the end of input for an empty stream.
     */
    streamInfo() {
        return {
            comment: parsePrelude(this.prelude).comment,
            directives: this.directives,
            errors: this.errors,
            warnings: this.warnings
        };
    }
    /**
     * Compose tokens into documents.
     *
     * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
     * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
     */
    *compose(tokens, forceDoc = false, endOffset = -1) {
        for (const token of tokens)
            yield* this.next(token);
        yield* this.end(forceDoc, endOffset);
    }
    /** Advance the composer by one CST token. */
    *next(token) {
        if (node_process.env.LOG_STREAM)
            console.dir(token, { depth: null });
        switch (token.type) {
            case 'directive':
                this.directives.add(token.source, (offset, message, warning) => {
                    const pos = getErrorPos(token);
                    pos[0] += offset;
                    this.onError(pos, 'BAD_DIRECTIVE', message, warning);
                });
                this.prelude.push(token.source);
                this.atDirectives = true;
                break;
            case 'document': {
                const doc = composeDoc.composeDoc(this.options, this.directives, token, this.onError);
                if (this.atDirectives && !doc.directives.docStart)
                    this.onError(token, 'MISSING_CHAR', 'Missing directives-end/doc-start indicator line');
                this.decorate(doc, false);
                if (this.doc)
                    yield this.doc;
                this.doc = doc;
                this.atDirectives = false;
                break;
            }
            case 'byte-order-mark':
            case 'space':
                break;
            case 'comment':
            case 'newline':
                this.prelude.push(token.source);
                break;
            case 'error': {
                const msg = token.source
                    ? `${token.message}: ${JSON.stringify(token.source)}`
                    : token.message;
                const error = new errors.YAMLParseError(getErrorPos(token), 'UNEXPECTED_TOKEN', msg);
                if (this.atDirectives || !this.doc)
                    this.errors.push(error);
                else
                    this.doc.errors.push(error);
                break;
            }
            case 'doc-end': {
                if (!this.doc) {
                    const msg = 'Unexpected doc-end without preceding document';
                    this.errors.push(new errors.YAMLParseError(getErrorPos(token), 'UNEXPECTED_TOKEN', msg));
                    break;
                }
                this.doc.directives.docEnd = true;
                const end = resolveEnd.resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
                this.decorate(this.doc, true);
                if (end.comment) {
                    const dc = this.doc.comment;
                    this.doc.comment = dc ? `${dc}\n${end.comment}` : end.comment;
                }
                this.doc.range[2] = end.offset;
                break;
            }
            default:
                this.errors.push(new errors.YAMLParseError(getErrorPos(token), 'UNEXPECTED_TOKEN', `Unsupported token ${token.type}`));
        }
    }
    /**
     * Call at end of input to yield any remaining document.
     *
     * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
     * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
     */
    *end(forceDoc = false, endOffset = -1) {
        if (this.doc) {
            this.decorate(this.doc, true);
            yield this.doc;
            this.doc = null;
        }
        else if (forceDoc) {
            const opts = Object.assign({ _directives: this.directives }, this.options);
            const doc = new Document.Document(undefined, opts);
            if (this.atDirectives)
                this.onError(endOffset, 'MISSING_CHAR', 'Missing directives-end indicator line');
            doc.range = [0, endOffset, endOffset];
            this.decorate(doc, false);
            yield doc;
        }
    }
}

exports.Composer = Composer;


/***/ }),

/***/ 7103:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var Pair = __nccwpck_require__(7165);
var YAMLMap = __nccwpck_require__(4454);
var resolveProps = __nccwpck_require__(4631);
var utilContainsNewline = __nccwpck_require__(9499);
var utilFlowIndentCheck = __nccwpck_require__(4051);
var utilMapIncludes = __nccwpck_require__(1187);

const startColMsg = 'All mapping items must start at the same column';
function resolveBlockMap({ composeNode, composeEmptyNode }, ctx, bm, onError, tag) {
    const NodeClass = tag?.nodeClass ?? YAMLMap.YAMLMap;
    const map = new NodeClass(ctx.schema);
    if (ctx.atRoot)
        ctx.atRoot = false;
    let offset = bm.offset;
    let commentEnd = null;
    for (const collItem of bm.items) {
        const { start, key, sep, value } = collItem;
        // key properties
        const keyProps = resolveProps.resolveProps(start, {
            indicator: 'explicit-key-ind',
            next: key ?? sep?.[0],
            offset,
            onError,
            parentIndent: bm.indent,
            startOnNewline: true
        });
        const implicitKey = !keyProps.found;
        if (implicitKey) {
            if (key) {
                if (key.type === 'block-seq')
                    onError(offset, 'BLOCK_AS_IMPLICIT_KEY', 'A block sequence may not be used as an implicit map key');
                else if ('indent' in key && key.indent !== bm.indent)
                    onError(offset, 'BAD_INDENT', startColMsg);
            }
            if (!keyProps.anchor && !keyProps.tag && !sep) {
                commentEnd = keyProps.end;
                if (keyProps.comment) {
                    if (map.comment)
                        map.comment += '\n' + keyProps.comment;
                    else
                        map.comment = keyProps.comment;
                }
                continue;
            }
            if (keyProps.newlineAfterProp || utilContainsNewline.containsNewline(key)) {
                onError(key ?? start[start.length - 1], 'MULTILINE_IMPLICIT_KEY', 'Implicit keys need to be on a single line');
            }
        }
        else if (keyProps.found?.indent !== bm.indent) {
            onError(offset, 'BAD_INDENT', startColMsg);
        }
        // key value
        ctx.atKey = true;
        const keyStart = keyProps.end;
        const keyNode = key
            ? composeNode(ctx, key, keyProps, onError)
            : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
        if (ctx.schema.compat)
            utilFlowIndentCheck.flowIndentCheck(bm.indent, key, onError);
        ctx.atKey = false;
        if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
            onError(keyStart, 'DUPLICATE_KEY', 'Map keys must be unique');
        // value properties
        const valueProps = resolveProps.resolveProps(sep ?? [], {
            indicator: 'map-value-ind',
            next: value,
            offset: keyNode.range[2],
            onError,
            parentIndent: bm.indent,
            startOnNewline: !key || key.type === 'block-scalar'
        });
        offset = valueProps.end;
        if (valueProps.found) {
            if (implicitKey) {
                if (value?.type === 'block-map' && !valueProps.hasNewline)
                    onError(offset, 'BLOCK_AS_IMPLICIT_KEY', 'Nested mappings are not allowed in compact mappings');
                if (ctx.options.strict &&
                    keyProps.start < valueProps.found.offset - 1024)
                    onError(keyNode.range, 'KEY_OVER_1024_CHARS', 'The : indicator must be at most 1024 chars after the start of an implicit block mapping key');
            }
            // value value
            const valueNode = value
                ? composeNode(ctx, value, valueProps, onError)
                : composeEmptyNode(ctx, offset, sep, null, valueProps, onError);
            if (ctx.schema.compat)
                utilFlowIndentCheck.flowIndentCheck(bm.indent, value, onError);
            offset = valueNode.range[2];
            const pair = new Pair.Pair(keyNode, valueNode);
            if (ctx.options.keepSourceTokens)
                pair.srcToken = collItem;
            map.items.push(pair);
        }
        else {
            // key with no value
            if (implicitKey)
                onError(keyNode.range, 'MISSING_CHAR', 'Implicit map keys need to be followed by map values');
            if (valueProps.comment) {
                if (keyNode.comment)
                    keyNode.comment += '\n' + valueProps.comment;
                else
                    keyNode.comment = valueProps.comment;
            }
            const pair = new Pair.Pair(keyNode);
            if (ctx.options.keepSourceTokens)
                pair.srcToken = collItem;
            map.items.push(pair);
        }
    }
    if (commentEnd && commentEnd < offset)
        onError(commentEnd, 'IMPOSSIBLE', 'Map comment with trailing content');
    map.range = [bm.offset, offset, commentEnd ?? offset];
    return map;
}

exports.resolveBlockMap = resolveBlockMap;


/***/ }),

/***/ 8913:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var Scalar = __nccwpck_require__(3301);

function resolveBlockScalar(ctx, scalar, onError) {
    const start = scalar.offset;
    const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
    if (!header)
        return { value: '', type: null, comment: '', range: [start, start, start] };
    const type = header.mode === '>' ? Scalar.Scalar.BLOCK_FOLDED : Scalar.Scalar.BLOCK_LITERAL;
    const lines = scalar.source ? splitLines(scalar.source) : [];
    // determine the end of content & start of chomping
    let chompStart = lines.length;
    for (let i = lines.length - 1; i >= 0; --i) {
        const content = lines[i][1];
        if (content === '' || content === '\r')
            chompStart = i;
        else
            break;
    }
    // shortcut for empty contents
    if (chompStart === 0) {
        const value = header.chomp === '+' && lines.length > 0
            ? '\n'.repeat(Math.max(1, lines.length - 1))
            : '';
        let end = start + header.length;
        if (scalar.source)
            end += scalar.source.length;
        return { value, type, comment: header.comment, range: [start, end, end] };
    }
    // find the indentation level to trim from start
    let trimIndent = scalar.indent + header.indent;
    let offset = scalar.offset + header.length;
    let contentStart = 0;
    for (let i = 0; i < chompStart; ++i) {
        const [indent, content] = lines[i];
        if (content === '' || content === '\r') {
            if (header.indent === 0 && indent.length > trimIndent)
                trimIndent = indent.length;
        }
        else {
            if (indent.length < trimIndent) {
                const message = 'Block scalars with more-indented leading empty lines must use an explicit indentation indicator';
                onError(offset + indent.length, 'MISSING_CHAR', message);
            }
            if (header.indent === 0)
                trimIndent = indent.length;
            contentStart = i;
            if (trimIndent === 0 && !ctx.atRoot) {
                const message = 'Block scalar values in collections must be indented';
                onError(offset, 'BAD_INDENT', message);
            }
            break;
        }
        offset += indent.length + content.length + 1;
    }
    // include trailing more-indented empty lines in content
    for (let i = lines.length - 1; i >= chompStart; --i) {
        if (lines[i][0].length > trimIndent)
            chompStart = i + 1;
    }
    let value = '';
    let sep = '';
    let prevMoreIndented = false;
    // leading whitespace is kept intact
    for (let i = 0; i < contentStart; ++i)
        value += lines[i][0].slice(trimIndent) + '\n';
    for (let i = contentStart; i < chompStart; ++i) {
        let [indent, content] = lines[i];
        offset += indent.length + content.length + 1;
        const crlf = content[content.length - 1] === '\r';
        if (crlf)
            content = content.slice(0, -1);
        /* istanbul ignore if already caught in lexer */
        if (content && indent.length < trimIndent) {
            const src = header.indent
                ? 'explicit indentation indicator'
                : 'first line';
            const message = `Block scalar lines must not be less indented than their ${src}`;
            onError(offset - content.length - (crlf ? 2 : 1), 'BAD_INDENT', message);
            indent = '';
        }
        if (type === Scalar.Scalar.BLOCK_LITERAL) {
            value += sep + indent.slice(trimIndent) + content;
            sep = '\n';
        }
        else if (indent.length > trimIndent || content[0] === '\t') {
            // more-indented content within a folded block
            if (sep === ' ')
                sep = '\n';
            else if (!prevMoreIndented && sep === '\n')
                sep = '\n\n';
            value += sep + indent.slice(trimIndent) + content;
            sep = '\n';
            prevMoreIndented = true;
        }
        else if (content === '') {
            // empty line
            if (sep === '\n')
                value += '\n';
            else
                sep = '\n';
        }
        else {
            value += sep + content;
            sep = ' ';
            prevMoreIndented = false;
        }
    }
    switch (header.chomp) {
        case '-':
            break;
        case '+':
            for (let i = chompStart; i < lines.length; ++i)
                value += '\n' + lines[i][0].slice(trimIndent);
            if (value[value.length - 1] !== '\n')
                value += '\n';
            break;
        default:
            value += '\n';
    }
    const end = start + header.length + scalar.source.length;
    return { value, type, comment: header.comment, range: [start, end, end] };
}
function parseBlockScalarHeader({ offset, props }, strict, onError) {
    /* istanbul ignore if should not happen */
    if (props[0].type !== 'block-scalar-header') {
        onError(props[0], 'IMPOSSIBLE', 'Block scalar header not found');
        return null;
    }
    const { source } = props[0];
    const mode = source[0];
    let indent = 0;
    let chomp = '';
    let error = -1;
    for (let i = 1; i < source.length; ++i) {
        const ch = source[i];
        if (!chomp && (ch === '-' || ch === '+'))
            chomp = ch;
        else {
            const n = Number(ch);
            if (!indent && n)
                indent = n;
            else if (error === -1)
                error = offset + i;
        }
    }
    if (error !== -1)
        onError(error, 'UNEXPECTED_TOKEN', `Block scalar header includes extra characters: ${source}`);
    let hasSpace = false;
    let comment = '';
    let length = source.length;
    for (let i = 1; i < props.length; ++i) {
        const token = props[i];
        switch (token.type) {
            case 'space':
                hasSpace = true;
            // fallthrough
            case 'newline':
                length += token.source.length;
                break;
            case 'comment':
                if (strict && !hasSpace) {
                    const message = 'Comments must be separated from other tokens by white space characters';
                    onError(token, 'MISSING_CHAR', message);
                }
                length += token.source.length;
                comment = token.source.substring(1);
                break;
            case 'error':
                onError(token, 'UNEXPECTED_TOKEN', token.message);
                length += token.source.length;
                break;
            /* istanbul ignore next should not happen */
            default: {
                const message = `Unexpected token in block scalar header: ${token.type}`;
                onError(token, 'UNEXPECTED_TOKEN', message);
                const ts = token.source;
                if (ts && typeof ts === 'string')
                    length += ts.length;
            }
        }
    }
    return { mode, indent, chomp, comment, length };
}
/** @returns Array of lines split up as `[indent, content]` */
function splitLines(source) {
    const split = source.split(/\n( *)/);
    const first = split[0];
    const m = first.match(/^( *)/);
    const line0 = m?.[1]
        ? [m[1], first.slice(m[1].length)]
        : ['', first];
    const lines = [line0];
    for (let i = 1; i < split.length; i += 2)
        lines.push([split[i], split[i + 1]]);
    return lines;
}

exports.resolveBlockScalar = resolveBlockScalar;


/***/ }),

/***/ 334:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var YAMLSeq = __nccwpck_require__(2223);
var resolveProps = __nccwpck_require__(4631);
var utilFlowIndentCheck = __nccwpck_require__(4051);

function resolveBlockSeq({ composeNode, composeEmptyNode }, ctx, bs, onError, tag) {
    const NodeClass = tag?.nodeClass ?? YAMLSeq.YAMLSeq;
    const seq = new NodeClass(ctx.schema);
    if (ctx.atRoot)
        ctx.atRoot = false;
    if (ctx.atKey)
        ctx.atKey = false;
    let offset = bs.offset;
    let commentEnd = null;
    for (const { start, value } of bs.items) {
        const props = resolveProps.resolveProps(start, {
            indicator: 'seq-item-ind',
            next: value,
            offset,
            onError,
            parentIndent: bs.indent,
            startOnNewline: true
        });
        if (!props.found) {
            if (props.anchor || props.tag || value) {
                if (value?.type === 'block-seq')
                    onError(props.end, 'BAD_INDENT', 'All sequence items must start at the same column');
                else
                    onError(offset, 'MISSING_CHAR', 'Sequence item without - indicator');
            }
            else {
                commentEnd = props.end;
                if (props.comment)
                    seq.comment = props.comment;
                continue;
            }
        }
        const node = value
            ? composeNode(ctx, value, props, onError)
            : composeEmptyNode(ctx, props.end, start, null, props, onError);
        if (ctx.schema.compat)
            utilFlowIndentCheck.flowIndentCheck(bs.indent, value, onError);
        offset = node.range[2];
        seq.items.push(node);
    }
    seq.range = [bs.offset, offset, commentEnd ?? offset];
    return seq;
}

exports.resolveBlockSeq = resolveBlockSeq;


/***/ }),

/***/ 7788:
/***/ ((__unused_webpack_module, exports) => {



function resolveEnd(end, offset, reqSpace, onError) {
    let comment = '';
    if (end) {
        let hasSpace = false;
        let sep = '';
        for (const token of end) {
            const { source, type } = token;
            switch (type) {
                case 'space':
                    hasSpace = true;
                    break;
                case 'comment': {
                    if (reqSpace && !hasSpace)
                        onError(token, 'MISSING_CHAR', 'Comments must be separated from other tokens by white space characters');
                    const cb = source.substring(1) || ' ';
                    if (!comment)
                        comment = cb;
                    else
                        comment += sep + cb;
                    sep = '';
                    break;
                }
                case 'newline':
                    if (comment)
                        sep += source;
                    hasSpace = true;
                    break;
                default:
                    onError(token, 'UNEXPECTED_TOKEN', `Unexpected ${type} at node end`);
            }
            offset += source.length;
        }
    }
    return { comment, offset };
}

exports.resolveEnd = resolveEnd;


/***/ }),

/***/ 3142:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var identity = __nccwpck_require__(1127);
var Pair = __nccwpck_require__(7165);
var YAMLMap = __nccwpck_require__(4454);
var YAMLSeq = __nccwpck_require__(2223);
var resolveEnd = __nccwpck_require__(7788);
var resolveProps = __nccwpck_require__(4631);
var utilContainsNewline = __nccwpck_require__(9499);
var utilMapIncludes = __nccwpck_require__(1187);

const blockMsg = 'Block collections are not allowed within flow collections';
const isBlock = (token) => token && (token.type === 'block-map' || token.type === 'block-seq');
function resolveFlowCollection({ composeNode, composeEmptyNode }, ctx, fc, onError, tag) {
    const isMap = fc.start.source === '{';
    const fcName = isMap ? 'flow map' : 'flow sequence';
    const NodeClass = (tag?.nodeClass ?? (isMap ? YAMLMap.YAMLMap : YAMLSeq.YAMLSeq));
    const coll = new NodeClass(ctx.schema);
    coll.flow = true;
    const atRoot = ctx.atRoot;
    if (atRoot)
        ctx.atRoot = false;
    if (ctx.atKey)
        ctx.atKey = false;
    let offset = fc.offset + fc.start.source.length;
    for (let i = 0; i < fc.items.length; ++i) {
        const collItem = fc.items[i];
        const { start, key, sep, value } = collItem;
        const props = resolveProps.resolveProps(start, {
            flow: fcName,
            indicator: 'explicit-key-ind',
            next: key ?? sep?.[0],
            offset,
            onError,
            parentIndent: fc.indent,
            startOnNewline: false
        });
        if (!props.found) {
            if (!props.anchor && !props.tag && !sep && !value) {
                if (i === 0 && props.comma)
                    onError(props.comma, 'UNEXPECTED_TOKEN', `Unexpected , in ${fcName}`);
                else if (i < fc.items.length - 1)
                    onError(props.start, 'UNEXPECTED_TOKEN', `Unexpected empty item in ${fcName}`);
                if (props.comment) {
                    if (coll.comment)
                        coll.comment += '\n' + props.comment;
                    else
                        coll.comment = props.comment;
                }
                offset = props.end;
                continue;
            }
            if (!isMap && ctx.options.strict && utilContainsNewline.containsNewline(key))
                onError(key, // checked by containsNewline()
                'MULTILINE_IMPLICIT_KEY', 'Implicit keys of flow sequence pairs need to be on a single line');
        }
        if (i === 0) {
            if (props.comma)
                onError(props.comma, 'UNEXPECTED_TOKEN', `Unexpected , in ${fcName}`);
        }
        else {
            if (!props.comma)
                onError(props.start, 'MISSING_CHAR', `Missing , between ${fcName} items`);
            if (props.comment) {
                let prevItemComment = '';
                loop: for (const st of start) {
                    switch (st.type) {
                        case 'comma':
                        case 'space':
                            break;
                        case 'comment':
                            prevItemComment = st.source.substring(1);
                            break loop;
                        default:
                            break loop;
                    }
                }
                if (prevItemComment) {
                    let prev = coll.items[coll.items.length - 1];
                    if (identity.isPair(prev))
                        prev = prev.value ?? prev.key;
                    if (prev.comment)
                        prev.comment += '\n' + prevItemComment;
                    else
                        prev.comment = prevItemComment;
                    props.comment = props.comment.substring(prevItemComment.length + 1);
                }
            }
        }
        if (!isMap && !sep && !props.found) {
            // item is a value in a seq
            // → key & sep are empty, start does not include ? or :
            const valueNode = value
                ? composeNode(ctx, value, props, onError)
                : composeEmptyNode(ctx, props.end, sep, null, props, onError);
            coll.items.push(valueNode);
            offset = valueNode.range[2];
            if (isBlock(value))
                onError(valueNode.range, 'BLOCK_IN_FLOW', blockMsg);
        }
        else {
            // item is a key+value pair
            // key value
            ctx.atKey = true;
            const keyStart = props.end;
            const keyNode = key
                ? composeNode(ctx, key, props, onError)
                : composeEmptyNode(ctx, keyStart, start, null, props, onError);
            if (isBlock(key))
                onError(keyNode.range, 'BLOCK_IN_FLOW', blockMsg);
            ctx.atKey = false;
            // value properties
            const valueProps = resolveProps.resolveProps(sep ?? [], {
                flow: fcName,
                indicator: 'map-value-ind',
                next: value,
                offset: keyNode.range[2],
                onError,
                parentIndent: fc.indent,
                startOnNewline: false
            });
            if (valueProps.found) {
                if (!isMap && !props.found && ctx.options.strict) {
                    if (sep)
                        for (const st of sep) {
                            if (st === valueProps.found)
                                break;
                            if (st.type === 'newline') {
                                onError(st, 'MULTILINE_IMPLICIT_KEY', 'Implicit keys of flow sequence pairs need to be on a single line');
                                break;
                            }
                        }
                    if (props.start < valueProps.found.offset - 1024)
                        onError(valueProps.found, 'KEY_OVER_1024_CHARS', 'The : indicator must be at most 1024 chars after the start of an implicit flow sequence key');
                }
            }
            else if (value) {
                if ('source' in value && value.source?.[0] === ':')
                    onError(value, 'MISSING_CHAR', `Missing space after : in ${fcName}`);
                else
                    onError(valueProps.start, 'MISSING_CHAR', `Missing , or : between ${fcName} items`);
            }
            // value value
            const valueNode = value
                ? composeNode(ctx, value, valueProps, onError)
                : valueProps.found
                    ? composeEmptyNode(ctx, valueProps.end, sep, null, valueProps, onError)
                    : null;
            if (valueNode) {
                if (isBlock(value))
                    onError(valueNode.range, 'BLOCK_IN_FLOW', blockMsg);
            }
            else if (valueProps.comment) {
                if (keyNode.comment)
                    keyNode.comment += '\n' + valueProps.comment;
                else
                    keyNode.comment = valueProps.comment;
            }
            const pair = new Pair.Pair(keyNode, valueNode);
            if (ctx.options.keepSourceTokens)
                pair.srcToken = collItem;
            if (isMap) {
                const map = coll;
                if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
                    onError(keyStart, 'DUPLICATE_KEY', 'Map keys must be unique');
                map.items.push(pair);
            }
            else {
                const map = new YAMLMap.YAMLMap(ctx.schema);
                map.flow = true;
                map.items.push(pair);
                const endRange = (valueNode ?? keyNode).range;
                map.range = [keyNode.range[0], endRange[1], endRange[2]];
                coll.items.push(map);
            }
            offset = valueNode ? valueNode.range[2] : valueProps.end;
        }
    }
    const expectedEnd = isMap ? '}' : ']';
    const [ce, ...ee] = fc.end;
    let cePos = offset;
    if (ce?.source === expectedEnd)
        cePos = ce.offset + ce.source.length;
    else {
        const name = fcName[0].toUpperCase() + fcName.substring(1);
        const msg = atRoot
            ? `${name} must end with a ${expectedEnd}`
            : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
        onError(offset, atRoot ? 'MISSING_CHAR' : 'BAD_INDENT', msg);
        if (ce && ce.source.length !== 1)
            ee.unshift(ce);
    }
    if (ee.length > 0) {
        const end = resolveEnd.resolveEnd(ee, cePos, ctx.options.strict, onError);
        if (end.comment) {
            if (coll.comment)
                coll.comment += '\n' + end.comment;
            else
                coll.comment = end.comment;
        }
        coll.range = [fc.offset, cePos, end.offset];
    }
    else {
        coll.range = [fc.offset, cePos, cePos];
    }
    return coll;
}

exports.resolveFlowCollection = resolveFlowCollection;


/***/ }),

/***/ 6842:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var Scalar = __nccwpck_require__(3301);
var resolveEnd = __nccwpck_require__(7788);

function resolveFlowScalar(scalar, strict, onError) {
    const { offset, type, source, end } = scalar;
    let _type;
    let value;
    const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
    switch (type) {
        case 'scalar':
            _type = Scalar.Scalar.PLAIN;
            value = plainValue(source, _onError);
            break;
        case 'single-quoted-scalar':
            _type = Scalar.Scalar.QUOTE_SINGLE;
            value = singleQuotedValue(source, _onError);
            break;
        case 'double-quoted-scalar':
            _type = Scalar.Scalar.QUOTE_DOUBLE;
            value = doubleQuotedValue(source, _onError);
            break;
        /* istanbul ignore next should not happen */
        default:
            onError(scalar, 'UNEXPECTED_TOKEN', `Expected a flow scalar value, but found: ${type}`);
            return {
                value: '',
                type: null,
                comment: '',
                range: [offset, offset + source.length, offset + source.length]
            };
    }
    const valueEnd = offset + source.length;
    const re = resolveEnd.resolveEnd(end, valueEnd, strict, onError);
    return {
        value,
        type: _type,
        comment: re.comment,
        range: [offset, valueEnd, re.offset]
    };
}
function plainValue(source, onError) {
    let badChar = '';
    switch (source[0]) {
        /* istanbul ignore next should not happen */
        case '\t':
            badChar = 'a tab character';
            break;
        case ',':
            badChar = 'flow indicator character ,';
            break;
        case '%':
            badChar = 'directive indicator character %';
            break;
        case '|':
        case '>': {
            badChar = `block scalar indicator ${source[0]}`;
            break;
        }
        case '@':
        case '`': {
            badChar = `reserved character ${source[0]}`;
            break;
        }
    }
    if (badChar)
        onError(0, 'BAD_SCALAR_START', `Plain value cannot start with ${badChar}`);
    return foldLines(source);
}
function singleQuotedValue(source, onError) {
    if (source[source.length - 1] !== "'" || source.length === 1)
        onError(source.length, 'MISSING_CHAR', "Missing closing 'quote");
    return foldLines(source.slice(1, -1)).replace(/''/g, "'");
}
function foldLines(source) {
    /**
     * The negative lookbehind here and in the `re` RegExp is to
     * prevent causing a polynomial search time in certain cases.
     *
     * The try-catch is for Safari, which doesn't support this yet:
     * https://caniuse.com/js-regexp-lookbehind
     */
    let first, line;
    try {
        first = new RegExp('(.*?)(?<![ \t])[ \t]*\r?\n', 'sy');
        line = new RegExp('[ \t]*(.*?)(?:(?<![ \t])[ \t]*)?\r?\n', 'sy');
    }
    catch {
        first = /(.*?)[ \t]*\r?\n/sy;
        line = /[ \t]*(.*?)[ \t]*\r?\n/sy;
    }
    let match = first.exec(source);
    if (!match)
        return source;
    let res = match[1];
    let sep = ' ';
    let pos = first.lastIndex;
    line.lastIndex = pos;
    while ((match = line.exec(source))) {
        if (match[1] === '') {
            if (sep === '\n')
                res += sep;
            else
                sep = '\n';
        }
        else {
            res += sep + match[1];
            sep = ' ';
        }
        pos = line.lastIndex;
    }
    const last = /[ \t]*(.*)/sy;
    last.lastIndex = pos;
    match = last.exec(source);
    return res + sep + (match?.[1] ?? '');
}
function doubleQuotedValue(source, onError) {
    let res = '';
    for (let i = 1; i < source.length - 1; ++i) {
        const ch = source[i];
        if (ch === '\r' && source[i + 1] === '\n')
            continue;
        if (ch === '\n') {
            const { fold, offset } = foldNewline(source, i);
            res += fold;
            i = offset;
        }
        else if (ch === '\\') {
            let next = source[++i];
            const cc = escapeCodes[next];
            if (cc)
                res += cc;
            else if (next === '\n') {
                // skip escaped newlines, but still trim the following line
                next = source[i + 1];
                while (next === ' ' || next === '\t')
                    next = source[++i + 1];
            }
            else if (next === '\r' && source[i + 1] === '\n') {
                // skip escaped CRLF newlines, but still trim the following line
                next = source[++i + 1];
                while (next === ' ' || next === '\t')
                    next = source[++i + 1];
            }
            else if (next === 'x' || next === 'u' || next === 'U') {
                const length = next === 'x' ? 2 : next === 'u' ? 4 : 8;
                res += parseCharCode(source, i + 1, length, onError);
                i += length;
            }
            else {
                const raw = source.substr(i - 1, 2);
                onError(i - 1, 'BAD_DQ_ESCAPE', `Invalid escape sequence ${raw}`);
                res += raw;
            }
        }
        else if (ch === ' ' || ch === '\t') {
            // trim trailing whitespace
            const wsStart = i;
            let next = source[i + 1];
            while (next === ' ' || next === '\t')
                next = source[++i + 1];
            if (next !== '\n' && !(next === '\r' && source[i + 2] === '\n'))
                res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
        }
        else {
            res += ch;
        }
    }
    if (source[source.length - 1] !== '"' || source.length === 1)
        onError(source.length, 'MISSING_CHAR', 'Missing closing "quote');
    return res;
}
/**
 * Fold a single newline into a space, multiple newlines to N - 1 newlines.
 * Presumes `source[offset] === '\n'`
 */
function foldNewline(source, offset) {
    let fold = '';
    let ch = source[offset + 1];
    while (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
        if (ch === '\r' && source[offset + 2] !== '\n')
            break;
        if (ch === '\n')
            fold += '\n';
        offset += 1;
        ch = source[offset + 1];
    }
    if (!fold)
        fold = ' ';
    return { fold, offset };
}
const escapeCodes = {
    '0': '\0', // null character
    a: '\x07', // bell character
    b: '\b', // backspace
    e: '\x1b', // escape character
    f: '\f', // form feed
    n: '\n', // line feed
    r: '\r', // carriage return
    t: '\t', // horizontal tab
    v: '\v', // vertical tab
    N: '\u0085', // Unicode next line
    _: '\u00a0', // Unicode non-breaking space
    L: '\u2028', // Unicode line separator
    P: '\u2029', // Unicode paragraph separator
    ' ': ' ',
    '"': '"',
    '/': '/',
    '\\': '\\',
    '\t': '\t'
};
function parseCharCode(source, offset, length, onError) {
    const cc = source.substr(offset, length);
    const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
    const code = ok ? parseInt(cc, 16) : NaN;
    try {
        return String.fromCodePoint(code);
    }
    catch {
        const raw = source.substr(offset - 2, length + 2);
        onError(offset - 2, 'BAD_DQ_ESCAPE', `Invalid escape sequence ${raw}`);
        return raw;
    }
}

exports.resolveFlowScalar = resolveFlowScalar;


/***/ }),

/***/ 4631:
/***/ ((__unused_webpack_module, exports) => {



function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
    let spaceBefore = false;
    let atNewline = startOnNewline;
    let hasSpace = startOnNewline;
    let comment = '';
    let commentSep = '';
    let hasNewline = false;
    let reqSpace = false;
    let tab = null;
    let anchor = null;
    let tag = null;
    let newlineAfterProp = null;
    let comma = null;
    let found = null;
    let start = null;
    for (const token of tokens) {
        if (reqSpace) {
            if (token.type !== 'space' &&
                token.type !== 'newline' &&
                token.type !== 'comma')
                onError(token.offset, 'MISSING_CHAR', 'Tags and anchors must be separated from the next token by white space');
            reqSpace = false;
        }
        if (tab) {
            if (atNewline && token.type !== 'comment' && token.type !== 'newline') {
                onError(tab, 'TAB_AS_INDENT', 'Tabs are not allowed as indentation');
            }
            tab = null;
        }
        switch (token.type) {
            case 'space':
                // At the doc level, tabs at line start may be parsed
                // as leading white space rather than indentation.
                // In a flow collection, only the parser handles indent.
                if (!flow &&
                    (indicator !== 'doc-start' || next?.type !== 'flow-collection') &&
                    token.source.includes('\t')) {
                    tab = token;
                }
                hasSpace = true;
                break;
            case 'comment': {
                if (!hasSpace)
                    onError(token, 'MISSING_CHAR', 'Comments must be separated from other tokens by white space characters');
                const cb = token.source.substring(1) || ' ';
                if (!comment)
                    comment = cb;
                else
                    comment += commentSep + cb;
                commentSep = '';
                atNewline = false;
                break;
            }
            case 'newline':
                if (atNewline) {
                    if (comment)
                        comment += token.source;
                    else if (!found || indicator !== 'seq-item-ind')
                        spaceBefore = true;
                }
                else
                    commentSep += token.source;
                atNewline = true;
                hasNewline = true;
                if (anchor || tag)
                    newlineAfterProp = token;
                hasSpace = true;
                break;
            case 'anchor':
                if (anchor)
                    onError(token, 'MULTIPLE_ANCHORS', 'A node can have at most one anchor');
                if (token.source.endsWith(':'))
                    onError(token.offset + token.source.length - 1, 'BAD_ALIAS', 'Anchor ending in : is ambiguous', true);
                anchor = token;
                start ?? (start = token.offset);
                atNewline = false;
                hasSpace = false;
                reqSpace = true;
                break;
            case 'tag': {
                if (tag)
                    onError(token, 'MULTIPLE_TAGS', 'A node can have at most one tag');
                tag = token;
                start ?? (start = token.offset);
                atNewline = false;
                hasSpace = false;
                reqSpace = true;
                break;
            }
            case indicator:
                // Could here handle preceding comments differently
                if (anchor || tag)
                    onError(token, 'BAD_PROP_ORDER', `Anchors and tags must be after the ${token.source} indicator`);
                if (found)
                    onError(token, 'UNEXPECTED_TOKEN', `Unexpected ${token.source} in ${flow ?? 'collection'}`);
                found = token;
                atNewline =
                    indicator === 'seq-item-ind' || indicator === 'explicit-key-ind';
                hasSpace = false;
                break;
            case 'comma':
                if (flow) {
                    if (comma)
                        onError(token, 'UNEXPECTED_TOKEN', `Unexpected , in ${flow}`);
                    comma = token;
                    atNewline = false;
                    hasSpace = false;
                    break;
                }
            // else fallthrough
            default:
                onError(token, 'UNEXPECTED_TOKEN', `Unexpected ${token.type} token`);
                atNewline = false;
                hasSpace = false;
        }
    }
    const last = tokens[tokens.length - 1];
    const end = last ? last.offset + last.source.length : offset;
    if (reqSpace &&
        next &&
        next.type !== 'space' &&
        next.type !== 'newline' &&
        next.type !== 'comma' &&
        (next.type !== 'scalar' || next.source !== '')) {
        onError(next.offset, 'MISSING_CHAR', 'Tags and anchors must be separated from the next token by white space');
    }
    if (tab &&
        ((atNewline && tab.indent <= parentIndent) ||
            next?.type === 'block-map' ||
            next?.type === 'block-seq'))
        onError(tab, 'TAB_AS_INDENT', 'Tabs are not allowed as indentation');
    return {
        comma,
        found,
        spaceBefore,
        comment,
        hasNewline,
        anchor,
        tag,
        newlineAfterProp,
        end,
        start: start ?? end
    };
}

exports.resolveProps = resolveProps;


/***/ }),

/***/ 9499:
/***/ ((__unused_webpack_module, exports) => {



function containsNewline(key) {
    if (!key)
        return null;
    switch (key.type) {
        case 'alias':
        case 'scalar':
        case 'double-quoted-scalar':
        case 'single-quoted-scalar':
            if (key.source.includes('\n'))
                return true;
            if (key.end)
                for (const st of key.end)
                    if (st.type === 'newline')
                        return true;
            return false;
        case 'flow-collection':
            for (const it of key.items) {
                for (const st of it.start)
                    if (st.type === 'newline')
                        return true;
                if (it.sep)
                    for (const st of it.sep)
                        if (st.type === 'newline')
                            return true;
                if (containsNewline(it.key) || containsNewline(it.value))
                    return true;
            }
            return false;
        default:
            return true;
    }
}

exports.containsNewline = containsNewline;


/***/ }),

/***/ 2599:
/***/ ((__unused_webpack_module, exports) => {



function emptyScalarPosition(offset, before, pos) {
    if (before) {
        pos ?? (pos = before.length);
        for (let i = pos - 1; i >= 0; --i) {
            let st = before[i];
            switch (st.type) {
                case 'space':
                case 'comment':
                case 'newline':
                    offset -= st.source.length;
                    continue;
            }
            // Technically, an empty scalar is immediately after the last non-empty
            // node, but it's more useful to place it after any whitespace.
            st = before[++i];
            while (st?.type === 'space') {
                offset += st.source.length;
                st = before[++i];
            }
            break;
        }
    }
    return offset;
}

exports.emptyScalarPosition = emptyScalarPosition;


/***/ }),

/***/ 4051:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var utilContainsNewline = __nccwpck_require__(9499);

function flowIndentCheck(indent, fc, onError) {
    if (fc?.type === 'flow-collection') {
        const end = fc.end[0];
        if (end.indent === indent &&
            (end.source === ']' || end.source === '}') &&
            utilContainsNewline.containsNewline(fc)) {
            const msg = 'Flow end indicator should be more indented than parent';
            onError(end, 'BAD_INDENT', msg, true);
        }
    }
}

exports.flowIndentCheck = flowIndentCheck;


/***/ }),

/***/ 1187:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var identity = __nccwpck_require__(1127);

function mapIncludes(ctx, items, search) {
    const { uniqueKeys } = ctx.options;
    if (uniqueKeys === false)
        return false;
    const isEqual = typeof uniqueKeys === 'function'
        ? uniqueKeys
        : (a, b) => a === b || (identity.isScalar(a) && identity.isScalar(b) && a.value === b.value);
    return items.some(pair => isEqual(pair.key, search));
}

exports.mapIncludes = mapIncludes;


/***/ }),

/***/ 3021:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var Alias = __nccwpck_require__(4065);
var Collection = __nccwpck_require__(101);
var identity = __nccwpck_require__(1127);
var Pair = __nccwpck_require__(7165);
var toJS = __nccwpck_require__(4043);
var Schema = __nccwpck_require__(5840);
var stringifyDocument = __nccwpck_require__(6829);
var anchors = __nccwpck_require__(1596);
var applyReviver = __nccwpck_require__(3661);
var createNode = __nccwpck_require__(2404);
var directives = __nccwpck_require__(1342);

class Document {
    constructor(value, replacer, options) {
        /** A comment before this Document */
        this.commentBefore = null;
        /** A comment immediately after this Document */
        this.comment = null;
        /** Errors encountered during parsing. */
        this.errors = [];
        /** Warnings encountered during parsing. */
        this.warnings = [];
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.DOC });
        let _replacer = null;
        if (typeof replacer === 'function' || Array.isArray(replacer)) {
            _replacer = replacer;
        }
        else if (options === undefined && replacer) {
            options = replacer;
            replacer = undefined;
        }
        const opt = Object.assign({
            intAsBigInt: false,
            keepSourceTokens: false,
            logLevel: 'warn',
            prettyErrors: true,
            strict: true,
            stringKeys: false,
            uniqueKeys: true,
            version: '1.2'
        }, options);
        this.options = opt;
        let { version } = opt;
        if (options?._directives) {
            this.directives = options._directives.atDocument();
            if (this.directives.yaml.explicit)
                version = this.directives.yaml.version;
        }
        else
            this.directives = new directives.Directives({ version });
        this.setSchema(version, options);
        // @ts-expect-error We can't really know that this matches Contents.
        this.contents =
            value === undefined ? null : this.createNode(value, _replacer, options);
    }
    /**
     * Create a deep copy of this Document and its contents.
     *
     * Custom Node values that inherit from `Object` still refer to their original instances.
     */
    clone() {
        const copy = Object.create(Document.prototype, {
            [identity.NODE_TYPE]: { value: identity.DOC }
        });
        copy.commentBefore = this.commentBefore;
        copy.comment = this.comment;
        copy.errors = this.errors.slice();
        copy.warnings = this.warnings.slice();
        copy.options = Object.assign({}, this.options);
        if (this.directives)
            copy.directives = this.directives.clone();
        copy.schema = this.schema.clone();
        // @ts-expect-error We can't really know that this matches Contents.
        copy.contents = identity.isNode(this.contents)
            ? this.contents.clone(copy.schema)
            : this.contents;
        if (this.range)
            copy.range = this.range.slice();
        return copy;
    }
    /** Adds a value to the document. */
    add(value) {
        if (assertCollection(this.contents))
            this.contents.add(value);
    }
    /** Adds a value to the document. */
    addIn(path, value) {
        if (assertCollection(this.contents))
            this.contents.addIn(path, value);
    }
    /**
     * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
     *
     * If `node` already has an anchor, `name` is ignored.
     * Otherwise, the `node.anchor` value will be set to `name`,
     * or if an anchor with that name is already present in the document,
     * `name` will be used as a prefix for a new unique anchor.
     * If `name` is undefined, the generated anchor will use 'a' as a prefix.
     */
    createAlias(node, name) {
        if (!node.anchor) {
            const prev = anchors.anchorNames(this);
            node.anchor =
                // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                !name || prev.has(name) ? anchors.findNewAnchor(name || 'a', prev) : name;
        }
        return new Alias.Alias(node.anchor);
    }
    createNode(value, replacer, options) {
        let _replacer = undefined;
        if (typeof replacer === 'function') {
            value = replacer.call({ '': value }, '', value);
            _replacer = replacer;
        }
        else if (Array.isArray(replacer)) {
            const keyToStr = (v) => typeof v === 'number' || v instanceof String || v instanceof Number;
            const asStr = replacer.filter(keyToStr).map(String);
            if (asStr.length > 0)
                replacer = replacer.concat(asStr);
            _replacer = replacer;
        }
        else if (options === undefined && replacer) {
            options = replacer;
            replacer = undefined;
        }
        const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
        const { onAnchor, setAnchors, sourceObjects } = anchors.createNodeAnchors(this, 
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        anchorPrefix || 'a');
        const ctx = {
            aliasDuplicateObjects: aliasDuplicateObjects ?? true,
            keepUndefined: keepUndefined ?? false,
            onAnchor,
            onTagObj,
            replacer: _replacer,
            schema: this.schema,
            sourceObjects
        };
        const node = createNode.createNode(value, tag, ctx);
        if (flow && identity.isCollection(node))
            node.flow = true;
        setAnchors();
        return node;
    }
    /**
     * Convert a key and a value into a `Pair` using the current schema,
     * recursively wrapping all values as `Scalar` or `Collection` nodes.
     */
    createPair(key, value, options = {}) {
        const k = this.createNode(key, null, options);
        const v = this.createNode(value, null, options);
        return new Pair.Pair(k, v);
    }
    /**
     * Removes a value from the document.
     * @returns `true` if the item was found and removed.
     */
    delete(key) {
        return assertCollection(this.contents) ? this.contents.delete(key) : false;
    }
    /**
     * Removes a value from the document.
     * @returns `true` if the item was found and removed.
     */
    deleteIn(path) {
        if (Collection.isEmptyPath(path)) {
            if (this.contents == null)
                return false;
            // @ts-expect-error Presumed impossible if Strict extends false
            this.contents = null;
            return true;
        }
        return assertCollection(this.contents)
            ? this.contents.deleteIn(path)
            : false;
    }
    /**
     * Returns item at `key`, or `undefined` if not found. By default unwraps
     * scalar values from their surrounding node; to disable set `keepScalar` to
     * `true` (collections are always returned intact).
     */
    get(key, keepScalar) {
        return identity.isCollection(this.contents)
            ? this.contents.get(key, keepScalar)
            : undefined;
    }
    /**
     * Returns item at `path`, or `undefined` if not found. By default unwraps
     * scalar values from their surrounding node; to disable set `keepScalar` to
     * `true` (collections are always returned intact).
     */
    getIn(path, keepScalar) {
        if (Collection.isEmptyPath(path))
            return !keepScalar && identity.isScalar(this.contents)
                ? this.contents.value
                : this.contents;
        return identity.isCollection(this.contents)
            ? this.contents.getIn(path, keepScalar)
            : undefined;
    }
    /**
     * Checks if the document includes a value with the key `key`.
     */
    has(key) {
        return identity.isCollection(this.contents) ? this.contents.has(key) : false;
    }
    /**
     * Checks if the document includes a value at `path`.
     */
    hasIn(path) {
        if (Collection.isEmptyPath(path))
            return this.contents !== undefined;
        return identity.isCollection(this.contents) ? this.contents.hasIn(path) : false;
    }
    /**
     * Sets a value in this document. For `!!set`, `value` needs to be a
     * boolean to add/remove the item from the set.
     */
    set(key, value) {
        if (this.contents == null) {
            // @ts-expect-error We can't really know that this matches Contents.
            this.contents = Collection.collectionFromPath(this.schema, [key], value);
        }
        else if (assertCollection(this.contents)) {
            this.contents.set(key, value);
        }
    }
    /**
     * Sets a value in this document. For `!!set`, `value` needs to be a
     * boolean to add/remove the item from the set.
     */
    setIn(path, value) {
        if (Collection.isEmptyPath(path)) {
            // @ts-expect-error We can't really know that this matches Contents.
            this.contents = value;
        }
        else if (this.contents == null) {
            // @ts-expect-error We can't really know that this matches Contents.
            this.contents = Collection.collectionFromPath(this.schema, Array.from(path), value);
        }
        else if (assertCollection(this.contents)) {
            this.contents.setIn(path, value);
        }
    }
    /**
     * Change the YAML version and schema used by the document.
     * A `null` version disables support for directives, explicit tags, anchors, and aliases.
     * It also requires the `schema` option to be given as a `Schema` instance value.
     *
     * Overrides all previously set schema options.
     */
    setSchema(version, options = {}) {
        if (typeof version === 'number')
            version = String(version);
        let opt;
        switch (version) {
            case '1.1':
                if (this.directives)
                    this.directives.yaml.version = '1.1';
                else
                    this.directives = new directives.Directives({ version: '1.1' });
                opt = { resolveKnownTags: false, schema: 'yaml-1.1' };
                break;
            case '1.2':
            case 'next':
                if (this.directives)
                    this.directives.yaml.version = version;
                else
                    this.directives = new directives.Directives({ version });
                opt = { resolveKnownTags: true, schema: 'core' };
                break;
            case null:
                if (this.directives)
                    delete this.directives;
                opt = null;
                break;
            default: {
                const sv = JSON.stringify(version);
                throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
            }
        }
        // Not using `instanceof Schema` to allow for duck typing
        if (options.schema instanceof Object)
            this.schema = options.schema;
        else if (opt)
            this.schema = new Schema.Schema(Object.assign(opt, options));
        else
            throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
    }
    // json & jsonArg are only used from toJSON()
    toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        const ctx = {
            anchors: new Map(),
            doc: this,
            keep: !json,
            mapAsMap: mapAsMap === true,
            mapKeyWarned: false,
            maxAliasCount: typeof maxAliasCount === 'number' ? maxAliasCount : 100
        };
        const res = toJS.toJS(this.contents, jsonArg ?? '', ctx);
        if (typeof onAnchor === 'function')
            for (const { count, res } of ctx.anchors.values())
                onAnchor(res, count);
        return typeof reviver === 'function'
            ? applyReviver.applyReviver(reviver, { '': res }, '', res)
            : res;
    }
    /**
     * A JSON representation of the document `contents`.
     *
     * @param jsonArg Used by `JSON.stringify` to indicate the array index or
     *   property name.
     */
    toJSON(jsonArg, onAnchor) {
        return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
    }
    /** A YAML representation of the document. */
    toString(options = {}) {
        if (this.errors.length > 0)
            throw new Error('Document with errors cannot be stringified');
        if ('indent' in options &&
            (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
            const s = JSON.stringify(options.indent);
            throw new Error(`"indent" option must be a positive integer, not ${s}`);
        }
        return stringifyDocument.stringifyDocument(this, options);
    }
}
function assertCollection(contents) {
    if (identity.isCollection(contents))
        return true;
    throw new Error('Expected a YAML collection as document contents');
}

exports.Document = Document;


/***/ }),

/***/ 1596:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var identity = __nccwpck_require__(1127);
var visit = __nccwpck_require__(204);

/**
 * Verify that the input string is a valid anchor.
 *
 * Will throw on errors.
 */
function anchorIsValid(anchor) {
    if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
        const sa = JSON.stringify(anchor);
        const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
        throw new Error(msg);
    }
    return true;
}
function anchorNames(root) {
    const anchors = new Set();
    visit.visit(root, {
        Value(_key, node) {
            if (node.anchor)
                anchors.add(node.anchor);
        }
    });
    return anchors;
}
/** Find a new anchor name with the given `prefix` and a one-indexed suffix. */
function findNewAnchor(prefix, exclude) {
    for (let i = 1; true; ++i) {
        const name = `${prefix}${i}`;
        if (!exclude.has(name))
            return name;
    }
}
function createNodeAnchors(doc, prefix) {
    const aliasObjects = [];
    const sourceObjects = new Map();
    let prevAnchors = null;
    return {
        onAnchor: (source) => {
            aliasObjects.push(source);
            prevAnchors ?? (prevAnchors = anchorNames(doc));
            const anchor = findNewAnchor(prefix, prevAnchors);
            prevAnchors.add(anchor);
            return anchor;
        },
        /**
         * With circular references, the source node is only resolved after all
         * of its child nodes are. This is why anchors are set only after all of
         * the nodes have been created.
         */
        setAnchors: () => {
            for (const source of aliasObjects) {
                const ref = sourceObjects.get(source);
                if (typeof ref === 'object' &&
                    ref.anchor &&
                    (identity.isScalar(ref.node) || identity.isCollection(ref.node))) {
                    ref.node.anchor = ref.anchor;
                }
                else {
                    const error = new Error('Failed to resolve repeated object (this should not happen)');
                    error.source = source;
                    throw error;
                }
            }
        },
        sourceObjects
    };
}

exports.anchorIsValid = anchorIsValid;
exports.anchorNames = anchorNames;
exports.createNodeAnchors = createNodeAnchors;
exports.findNewAnchor = findNewAnchor;


/***/ }),

/***/ 3661:
/***/ ((__unused_webpack_module, exports) => {



/**
 * Applies the JSON.parse reviver algorithm as defined in the ECMA-262 spec,
 * in section 24.5.1.1 "Runtime Semantics: InternalizeJSONProperty" of the
 * 2021 edition: https://tc39.es/ecma262/#sec-json.parse
 *
 * Includes extensions for handling Map and Set objects.
 */
function applyReviver(reviver, obj, key, val) {
    if (val && typeof val === 'object') {
        if (Array.isArray(val)) {
            for (let i = 0, len = val.length; i < len; ++i) {
                const v0 = val[i];
                const v1 = applyReviver(reviver, val, String(i), v0);
                // eslint-disable-next-line @typescript-eslint/no-array-delete
                if (v1 === undefined)
                    delete val[i];
                else if (v1 !== v0)
                    val[i] = v1;
            }
        }
        else if (val instanceof Map) {
            for (const k of Array.from(val.keys())) {
                const v0 = val.get(k);
                const v1 = applyReviver(reviver, val, k, v0);
                if (v1 === undefined)
                    val.delete(k);
                else if (v1 !== v0)
                    val.set(k, v1);
            }
        }
        else if (val instanceof Set) {
            for (const v0 of Array.from(val)) {
                const v1 = applyReviver(reviver, val, v0, v0);
                if (v1 === undefined)
                    val.delete(v0);
                else if (v1 !== v0) {
                    val.delete(v0);
                    val.add(v1);
                }
            }
        }
        else {
            for (const [k, v0] of Object.entries(val)) {
                const v1 = applyReviver(reviver, val, k, v0);
                if (v1 === undefined)
                    delete val[k];
                else if (v1 !== v0)
                    val[k] = v1;
            }
        }
    }
    return reviver.call(obj, key, val);
}

exports.applyReviver = applyReviver;


/***/ }),

/***/ 2404:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var Alias = __nccwpck_require__(4065);
var identity = __nccwpck_require__(1127);
var Scalar = __nccwpck_require__(3301);

const defaultTagPrefix = 'tag:yaml.org,2002:';
function findTagObject(value, tagName, tags) {
    if (tagName) {
        const match = tags.filter(t => t.tag === tagName);
        const tagObj = match.find(t => !t.format) ?? match[0];
        if (!tagObj)
            throw new Error(`Tag ${tagName} not found`);
        return tagObj;
    }
    return tags.find(t => t.identify?.(value) && !t.format);
}
function createNode(value, tagName, ctx) {
    if (identity.isDocument(value))
        value = value.contents;
    if (identity.isNode(value))
        return value;
    if (identity.isPair(value)) {
        const map = ctx.schema[identity.MAP].createNode?.(ctx.schema, null, ctx);
        map.items.push(value);
        return map;
    }
    if (value instanceof String ||
        value instanceof Number ||
        value instanceof Boolean ||
        (typeof BigInt !== 'undefined' && value instanceof BigInt) // not supported everywhere
    ) {
        // https://tc39.es/ecma262/#sec-serializejsonproperty
        value = value.valueOf();
    }
    const { aliasDuplicateObjects, onAnchor, onTagObj, schema, sourceObjects } = ctx;
    // Detect duplicate references to the same object & use Alias nodes for all
    // after first. The `ref` wrapper allows for circular references to resolve.
    let ref = undefined;
    if (aliasDuplicateObjects && value && typeof value === 'object') {
        ref = sourceObjects.get(value);
        if (ref) {
            ref.anchor ?? (ref.anchor = onAnchor(value));
            return new Alias.Alias(ref.anchor);
        }
        else {
            ref = { anchor: null, node: null };
            sourceObjects.set(value, ref);
        }
    }
    if (tagName?.startsWith('!!'))
        tagName = defaultTagPrefix + tagName.slice(2);
    let tagObj = findTagObject(value, tagName, schema.tags);
    if (!tagObj) {
        if (value && typeof value.toJSON === 'function') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            value = value.toJSON();
        }
        if (!value || typeof value !== 'object') {
            const node = new Scalar.Scalar(value);
            if (ref)
                ref.node = node;
            return node;
        }
        tagObj =
            value instanceof Map
                ? schema[identity.MAP]
                : Symbol.iterator in Object(value)
                    ? schema[identity.SEQ]
                    : schema[identity.MAP];
    }
    if (onTagObj) {
        onTagObj(tagObj);
        delete ctx.onTagObj;
    }
    const node = tagObj?.createNode
        ? tagObj.createNode(ctx.schema, value, ctx)
        : typeof tagObj?.nodeClass?.from === 'function'
            ? tagObj.nodeClass.from(ctx.schema, value, ctx)
            : new Scalar.Scalar(value);
    if (tagName)
        node.tag = tagName;
    else if (!tagObj.default)
        node.tag = tagObj.tag;
    if (ref)
        ref.node = node;
    return node;
}

exports.createNode = createNode;


/***/ }),

/***/ 1342:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var identity = __nccwpck_require__(1127);
var visit = __nccwpck_require__(204);

const escapeChars = {
    '!': '%21',
    ',': '%2C',
    '[': '%5B',
    ']': '%5D',
    '{': '%7B',
    '}': '%7D'
};
const escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, ch => escapeChars[ch]);
class Directives {
    constructor(yaml, tags) {
        /**
         * The directives-end/doc-start marker `---`. If `null`, a marker may still be
         * included in the document's stringified representation.
         */
        this.docStart = null;
        /** The doc-end marker `...`.  */
        this.docEnd = false;
        this.yaml = Object.assign({}, Directives.defaultYaml, yaml);
        this.tags = Object.assign({}, Directives.defaultTags, tags);
    }
    clone() {
        const copy = new Directives(this.yaml, this.tags);
        copy.docStart = this.docStart;
        return copy;
    }
    /**
     * During parsing, get a Directives instance for the current document and
     * update the stream state according to the current version's spec.
     */
    atDocument() {
        const res = new Directives(this.yaml, this.tags);
        switch (this.yaml.version) {
            case '1.1':
                this.atNextDocument = true;
                break;
            case '1.2':
                this.atNextDocument = false;
                this.yaml = {
                    explicit: Directives.defaultYaml.explicit,
                    version: '1.2'
                };
                this.tags = Object.assign({}, Directives.defaultTags);
                break;
        }
        return res;
    }
    /**
     * @param onError - May be called even if the action was successful
     * @returns `true` on success
     */
    add(line, onError) {
        if (this.atNextDocument) {
            this.yaml = { explicit: Directives.defaultYaml.explicit, version: '1.1' };
            this.tags = Object.assign({}, Directives.defaultTags);
            this.atNextDocument = false;
        }
        const parts = line.trim().split(/[ \t]+/);
        const name = parts.shift();
        switch (name) {
            case '%TAG': {
                if (parts.length !== 2) {
                    onError(0, '%TAG directive should contain exactly two parts');
                    if (parts.length < 2)
                        return false;
                }
                const [handle, prefix] = parts;
                this.tags[handle] = prefix;
                return true;
            }
            case '%YAML': {
                this.yaml.explicit = true;
                if (parts.length !== 1) {
                    onError(0, '%YAML directive should contain exactly one part');
                    return false;
                }
                const [version] = parts;
                if (version === '1.1' || version === '1.2') {
                    this.yaml.version = version;
                    return true;
                }
                else {
                    const isValid = /^\d+\.\d+$/.test(version);
                    onError(6, `Unsupported YAML version ${version}`, isValid);
                    return false;
                }
            }
            default:
                onError(0, `Unknown directive ${name}`, true);
                return false;
        }
    }
    /**
     * Resolves a tag, matching handles to those defined in %TAG directives.
     *
     * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
     *   `'!local'` tag, or `null` if unresolvable.
     */
    tagName(source, onError) {
        if (source === '!')
            return '!'; // non-specific tag
        if (source[0] !== '!') {
            onError(`Not a valid tag: ${source}`);
            return null;
        }
        if (source[1] === '<') {
            const verbatim = source.slice(2, -1);
            if (verbatim === '!' || verbatim === '!!') {
                onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
                return null;
            }
            if (source[source.length - 1] !== '>')
                onError('Verbatim tags must end with a >');
            return verbatim;
        }
        const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
        if (!suffix)
            onError(`The ${source} tag has no suffix`);
        const prefix = this.tags[handle];
        if (prefix) {
            try {
                return prefix + decodeURIComponent(suffix);
            }
            catch (error) {
                onError(String(error));
                return null;
            }
        }
        if (handle === '!')
            return source; // local tag
        onError(`Could not resolve tag: ${source}`);
        return null;
    }
    /**
     * Given a fully resolved tag, returns its printable string form,
     * taking into account current tag prefixes and defaults.
     */
    tagString(tag) {
        for (const [handle, prefix] of Object.entries(this.tags)) {
            if (tag.startsWith(prefix))
                return handle + escapeTagName(tag.substring(prefix.length));
        }
        return tag[0] === '!' ? tag : `!<${tag}>`;
    }
    toString(doc) {
        const lines = this.yaml.explicit
            ? [`%YAML ${this.yaml.version || '1.2'}`]
            : [];
        const tagEntries = Object.entries(this.tags);
        let tagNames;
        if (doc && tagEntries.length > 0 && identity.isNode(doc.contents)) {
            const tags = {};
            visit.visit(doc.contents, (_key, node) => {
                if (identity.isNode(node) && node.tag)
                    tags[node.tag] = true;
            });
            tagNames = Object.keys(tags);
        }
        else
            tagNames = [];
        for (const [handle, prefix] of tagEntries) {
            if (handle === '!!' && prefix === 'tag:yaml.org,2002:')
                continue;
            if (!doc || tagNames.some(tn => tn.startsWith(prefix)))
                lines.push(`%TAG ${handle} ${prefix}`);
        }
        return lines.join('\n');
    }
}
Directives.defaultYaml = { explicit: false, version: '1.2' };
Directives.defaultTags = { '!!': 'tag:yaml.org,2002:' };

exports.Directives = Directives;


/***/ }),

/***/ 1464:
/***/ ((__unused_webpack_module, exports) => {



class YAMLError extends Error {
    constructor(name, pos, code, message) {
        super();
        this.name = name;
        this.code = code;
        this.message = message;
        this.pos = pos;
    }
}
class YAMLParseError extends YAMLError {
    constructor(pos, code, message) {
        super('YAMLParseError', pos, code, message);
    }
}
class YAMLWarning extends YAMLError {
    constructor(pos, code, message) {
        super('YAMLWarning', pos, code, message);
    }
}
const prettifyError = (src, lc) => (error) => {
    if (error.pos[0] === -1)
        return;
    error.linePos = error.pos.map(pos => lc.linePos(pos));
    const { line, col } = error.linePos[0];
    error.message += ` at line ${line}, column ${col}`;
    let ci = col - 1;
    let lineStr = src
        .substring(lc.lineStarts[line - 1], lc.lineStarts[line])
        .replace(/[\n\r]+$/, '');
    // Trim to max 80 chars, keeping col position near the middle
    if (ci >= 60 && lineStr.length > 80) {
        const trimStart = Math.min(ci - 39, lineStr.length - 79);
        lineStr = '…' + lineStr.substring(trimStart);
        ci -= trimStart - 1;
    }
    if (lineStr.length > 80)
        lineStr = lineStr.substring(0, 79) + '…';
    // Include previous line in context if pointing at line start
    if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
        // Regexp won't match if start is trimmed
        let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
        if (prev.length > 80)
            prev = prev.substring(0, 79) + '…\n';
        lineStr = prev + lineStr;
    }
    if (/[^ ]/.test(lineStr)) {
        let count = 1;
        const end = error.linePos[1];
        if (end?.line === line && end.col > col) {
            count = Math.max(1, Math.min(end.col - col, 80 - ci));
        }
        const pointer = ' '.repeat(ci) + '^'.repeat(count);
        error.message += `:\n\n${lineStr}\n${pointer}\n`;
    }
};

exports.YAMLError = YAMLError;
exports.YAMLParseError = YAMLParseError;
exports.YAMLWarning = YAMLWarning;
exports.prettifyError = prettifyError;


/***/ }),

/***/ 8815:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

var __webpack_unused_export__;


var composer = __nccwpck_require__(9984);
var Document = __nccwpck_require__(3021);
var Schema = __nccwpck_require__(5840);
var errors = __nccwpck_require__(1464);
var Alias = __nccwpck_require__(4065);
var identity = __nccwpck_require__(1127);
var Pair = __nccwpck_require__(7165);
var Scalar = __nccwpck_require__(3301);
var YAMLMap = __nccwpck_require__(4454);
var YAMLSeq = __nccwpck_require__(2223);
var cst = __nccwpck_require__(3461);
var lexer = __nccwpck_require__(361);
var lineCounter = __nccwpck_require__(6628);
var parser = __nccwpck_require__(3456);
var publicApi = __nccwpck_require__(4047);
var visit = __nccwpck_require__(204);



__webpack_unused_export__ = composer.Composer;
__webpack_unused_export__ = Document.Document;
__webpack_unused_export__ = Schema.Schema;
__webpack_unused_export__ = errors.YAMLError;
__webpack_unused_export__ = errors.YAMLParseError;
__webpack_unused_export__ = errors.YAMLWarning;
__webpack_unused_export__ = Alias.Alias;
__webpack_unused_export__ = identity.isAlias;
__webpack_unused_export__ = identity.isCollection;
__webpack_unused_export__ = identity.isDocument;
__webpack_unused_export__ = identity.isMap;
__webpack_unused_export__ = identity.isNode;
__webpack_unused_export__ = identity.isPair;
__webpack_unused_export__ = identity.isScalar;
__webpack_unused_export__ = identity.isSeq;
__webpack_unused_export__ = Pair.Pair;
__webpack_unused_export__ = Scalar.Scalar;
__webpack_unused_export__ = YAMLMap.YAMLMap;
__webpack_unused_export__ = YAMLSeq.YAMLSeq;
__webpack_unused_export__ = cst;
__webpack_unused_export__ = lexer.Lexer;
__webpack_unused_export__ = lineCounter.LineCounter;
__webpack_unused_export__ = parser.Parser;
exports.qg = publicApi.parse;
__webpack_unused_export__ = publicApi.parseAllDocuments;
exports.Tp = publicApi.parseDocument;
exports.As = publicApi.stringify;
__webpack_unused_export__ = visit.visit;
__webpack_unused_export__ = visit.visitAsync;


/***/ }),

/***/ 7249:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var node_process = __nccwpck_require__(932);

function debug(logLevel, ...messages) {
    if (logLevel === 'debug')
        console.log(...messages);
}
function warn(logLevel, warning) {
    if (logLevel === 'debug' || logLevel === 'warn') {
        if (typeof node_process.emitWarning === 'function')
            node_process.emitWarning(warning);
        else
            console.warn(warning);
    }
}

exports.debug = debug;
exports.warn = warn;


/***/ }),

/***/ 4065:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var anchors = __nccwpck_require__(1596);
var visit = __nccwpck_require__(204);
var identity = __nccwpck_require__(1127);
var Node = __nccwpck_require__(6673);
var toJS = __nccwpck_require__(4043);

class Alias extends Node.NodeBase {
    constructor(source) {
        super(identity.ALIAS);
        this.source = source;
        Object.defineProperty(this, 'tag', {
            set() {
                throw new Error('Alias nodes cannot have tags');
            }
        });
    }
    /**
     * Resolve the value of this alias within `doc`, finding the last
     * instance of the `source` anchor before this node.
     */
    resolve(doc, ctx) {
        if (ctx?.maxAliasCount === 0)
            throw new ReferenceError('Alias resolution is disabled');
        let nodes;
        if (ctx?.aliasResolveCache) {
            nodes = ctx.aliasResolveCache;
        }
        else {
            nodes = [];
            visit.visit(doc, {
                Node: (_key, node) => {
                    if (identity.isAlias(node) || identity.hasAnchor(node))
                        nodes.push(node);
                }
            });
            if (ctx)
                ctx.aliasResolveCache = nodes;
        }
        let found = undefined;
        for (const node of nodes) {
            if (node === this)
                break;
            if (node.anchor === this.source)
                found = node;
        }
        return found;
    }
    toJSON(_arg, ctx) {
        if (!ctx)
            return { source: this.source };
        const { anchors, doc, maxAliasCount } = ctx;
        const source = this.resolve(doc, ctx);
        if (!source) {
            const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
            throw new ReferenceError(msg);
        }
        let data = anchors.get(source);
        if (!data) {
            // Resolve anchors for Node.prototype.toJS()
            toJS.toJS(source, null, ctx);
            data = anchors.get(source);
        }
        /* istanbul ignore if */
        if (data?.res === undefined) {
            const msg = 'This should not happen: Alias anchor was not resolved?';
            throw new ReferenceError(msg);
        }
        if (maxAliasCount >= 0) {
            data.count += 1;
            if (data.aliasCount === 0)
                data.aliasCount = getAliasCount(doc, source, anchors);
            if (data.count * data.aliasCount > maxAliasCount) {
                const msg = 'Excessive alias count indicates a resource exhaustion attack';
                throw new ReferenceError(msg);
            }
        }
        return data.res;
    }
    toString(ctx, _onComment, _onChompKeep) {
        const src = `*${this.source}`;
        if (ctx) {
            anchors.anchorIsValid(this.source);
            if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
                const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
                throw new Error(msg);
            }
            if (ctx.implicitKey)
                return `${src} `;
        }
        return src;
    }
}
function getAliasCount(doc, node, anchors) {
    if (identity.isAlias(node)) {
        const source = node.resolve(doc);
        const anchor = anchors && source && anchors.get(source);
        return anchor ? anchor.count * anchor.aliasCount : 0;
    }
    else if (identity.isCollection(node)) {
        let count = 0;
        for (const item of node.items) {
            const c = getAliasCount(doc, item, anchors);
            if (c > count)
                count = c;
        }
        return count;
    }
    else if (identity.isPair(node)) {
        const kc = getAliasCount(doc, node.key, anchors);
        const vc = getAliasCount(doc, node.value, anchors);
        return Math.max(kc, vc);
    }
    return 1;
}

exports.Alias = Alias;


/***/ }),

/***/ 101:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var createNode = __nccwpck_require__(2404);
var identity = __nccwpck_require__(1127);
var Node = __nccwpck_require__(6673);

function collectionFromPath(schema, path, value) {
    let v = value;
    for (let i = path.length - 1; i >= 0; --i) {
        const k = path[i];
        if (typeof k === 'number' && Number.isInteger(k) && k >= 0) {
            const a = [];
            a[k] = v;
            v = a;
        }
        else {
            v = new Map([[k, v]]);
        }
    }
    return createNode.createNode(v, undefined, {
        aliasDuplicateObjects: false,
        keepUndefined: false,
        onAnchor: () => {
            throw new Error('This should not happen, please report a bug.');
        },
        schema,
        sourceObjects: new Map()
    });
}
// Type guard is intentionally a little wrong so as to be more useful,
// as it does not cover untypable empty non-string iterables (e.g. []).
const isEmptyPath = (path) => path == null ||
    (typeof path === 'object' && !!path[Symbol.iterator]().next().done);
class Collection extends Node.NodeBase {
    constructor(type, schema) {
        super(type);
        Object.defineProperty(this, 'schema', {
            value: schema,
            configurable: true,
            enumerable: false,
            writable: true
        });
    }
    /**
     * Create a copy of this collection.
     *
     * @param schema - If defined, overwrites the original's schema
     */
    clone(schema) {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (schema)
            copy.schema = schema;
        copy.items = copy.items.map(it => identity.isNode(it) || identity.isPair(it) ? it.clone(schema) : it);
        if (this.range)
            copy.range = this.range.slice();
        return copy;
    }
    /**
     * Adds a value to the collection. For `!!map` and `!!omap` the value must
     * be a Pair instance or a `{ key, value }` object, which may not have a key
     * that already exists in the map.
     */
    addIn(path, value) {
        if (isEmptyPath(path))
            this.add(value);
        else {
            const [key, ...rest] = path;
            const node = this.get(key, true);
            if (identity.isCollection(node))
                node.addIn(rest, value);
            else if (node === undefined && this.schema)
                this.set(key, collectionFromPath(this.schema, rest, value));
            else
                throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
    }
    /**
     * Removes a value from the collection.
     * @returns `true` if the item was found and removed.
     */
    deleteIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
            return this.delete(key);
        const node = this.get(key, true);
        if (identity.isCollection(node))
            return node.deleteIn(rest);
        else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
    }
    /**
     * Returns item at `key`, or `undefined` if not found. By default unwraps
     * scalar values from their surrounding node; to disable set `keepScalar` to
     * `true` (collections are always returned intact).
     */
    getIn(path, keepScalar) {
        const [key, ...rest] = path;
        const node = this.get(key, true);
        if (rest.length === 0)
            return !keepScalar && identity.isScalar(node) ? node.value : node;
        else
            return identity.isCollection(node) ? node.getIn(rest, keepScalar) : undefined;
    }
    hasAllNullValues(allowScalar) {
        return this.items.every(node => {
            if (!identity.isPair(node))
                return false;
            const n = node.value;
            return (n == null ||
                (allowScalar &&
                    identity.isScalar(n) &&
                    n.value == null &&
                    !n.commentBefore &&
                    !n.comment &&
                    !n.tag));
        });
    }
    /**
     * Checks if the collection includes a value with the key `key`.
     */
    hasIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
            return this.has(key);
        const node = this.get(key, true);
        return identity.isCollection(node) ? node.hasIn(rest) : false;
    }
    /**
     * Sets a value in this collection. For `!!set`, `value` needs to be a
     * boolean to add/remove the item from the set.
     */
    setIn(path, value) {
        const [key, ...rest] = path;
        if (rest.length === 0) {
            this.set(key, value);
        }
        else {
            const node = this.get(key, true);
            if (identity.isCollection(node))
                node.setIn(rest, value);
            else if (node === undefined && this.schema)
                this.set(key, collectionFromPath(this.schema, rest, value));
            else
                throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
    }
}

exports.Collection = Collection;
exports.collectionFromPath = collectionFromPath;
exports.isEmptyPath = isEmptyPath;


/***/ }),

/***/ 6673:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var applyReviver = __nccwpck_require__(3661);
var identity = __nccwpck_require__(1127);
var toJS = __nccwpck_require__(4043);

class NodeBase {
    constructor(type) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: type });
    }
    /** Create a copy of this node.  */
    clone() {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (this.range)
            copy.range = this.range.slice();
        return copy;
    }
    /** A plain JavaScript representation of this node. */
    toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        if (!identity.isDocument(doc))
            throw new TypeError('A document argument is required');
        const ctx = {
            anchors: new Map(),
            doc,
            keep: true,
            mapAsMap: mapAsMap === true,
            mapKeyWarned: false,
            maxAliasCount: typeof maxAliasCount === 'number' ? maxAliasCount : 100
        };
        const res = toJS.toJS(this, '', ctx);
        if (typeof onAnchor === 'function')
            for (const { count, res } of ctx.anchors.values())
                onAnchor(res, count);
        return typeof reviver === 'function'
            ? applyReviver.applyReviver(reviver, { '': res }, '', res)
            : res;
    }
}

exports.NodeBase = NodeBase;


/***/ }),

/***/ 7165:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var createNode = __nccwpck_require__(2404);
var stringifyPair = __nccwpck_require__(9748);
var addPairToJSMap = __nccwpck_require__(7104);
var identity = __nccwpck_require__(1127);

function createPair(key, value, ctx) {
    const k = createNode.createNode(key, undefined, ctx);
    const v = createNode.createNode(value, undefined, ctx);
    return new Pair(k, v);
}
class Pair {
    constructor(key, value = null) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.PAIR });
        this.key = key;
        this.value = value;
    }
    clone(schema) {
        let { key, value } = this;
        if (identity.isNode(key))
            key = key.clone(schema);
        if (identity.isNode(value))
            value = value.clone(schema);
        return new Pair(key, value);
    }
    toJSON(_, ctx) {
        const pair = ctx?.mapAsMap ? new Map() : {};
        return addPairToJSMap.addPairToJSMap(ctx, pair, this);
    }
    toString(ctx, onComment, onChompKeep) {
        return ctx?.doc
            ? stringifyPair.stringifyPair(this, ctx, onComment, onChompKeep)
            : JSON.stringify(this);
    }
}

exports.Pair = Pair;
exports.createPair = createPair;


/***/ }),

/***/ 3301:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var identity = __nccwpck_require__(1127);
var Node = __nccwpck_require__(6673);
var toJS = __nccwpck_require__(4043);

const isScalarValue = (value) => !value || (typeof value !== 'function' && typeof value !== 'object');
class Scalar extends Node.NodeBase {
    constructor(value) {
        super(identity.SCALAR);
        this.value = value;
    }
    toJSON(arg, ctx) {
        return ctx?.keep ? this.value : toJS.toJS(this.value, arg, ctx);
    }
    toString() {
        return String(this.value);
    }
}
Scalar.BLOCK_FOLDED = 'BLOCK_FOLDED';
Scalar.BLOCK_LITERAL = 'BLOCK_LITERAL';
Scalar.PLAIN = 'PLAIN';
Scalar.QUOTE_DOUBLE = 'QUOTE_DOUBLE';
Scalar.QUOTE_SINGLE = 'QUOTE_SINGLE';

exports.Scalar = Scalar;
exports.isScalarValue = isScalarValue;


/***/ }),

/***/ 4454:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var stringifyCollection = __nccwpck_require__(1212);
var addPairToJSMap = __nccwpck_require__(7104);
var Collection = __nccwpck_require__(101);
var identity = __nccwpck_require__(1127);
var Pair = __nccwpck_require__(7165);
var Scalar = __nccwpck_require__(3301);

function findPair(items, key) {
    const k = identity.isScalar(key) ? key.value : key;
    for (const it of items) {
        if (identity.isPair(it)) {
            if (it.key === key || it.key === k)
                return it;
            if (identity.isScalar(it.key) && it.key.value === k)
                return it;
        }
    }
    return undefined;
}
class YAMLMap extends Collection.Collection {
    static get tagName() {
        return 'tag:yaml.org,2002:map';
    }
    constructor(schema) {
        super(identity.MAP, schema);
        this.items = [];
    }
    /**
     * A generic collection parsing method that can be extended
     * to other node classes that inherit from YAMLMap
     */
    static from(schema, obj, ctx) {
        const { keepUndefined, replacer } = ctx;
        const map = new this(schema);
        const add = (key, value) => {
            if (typeof replacer === 'function')
                value = replacer.call(obj, key, value);
            else if (Array.isArray(replacer) && !replacer.includes(key))
                return;
            if (value !== undefined || keepUndefined)
                map.items.push(Pair.createPair(key, value, ctx));
        };
        if (obj instanceof Map) {
            for (const [key, value] of obj)
                add(key, value);
        }
        else if (obj && typeof obj === 'object') {
            for (const key of Object.keys(obj))
                add(key, obj[key]);
        }
        if (typeof schema.sortMapEntries === 'function') {
            map.items.sort(schema.sortMapEntries);
        }
        return map;
    }
    /**
     * Adds a value to the collection.
     *
     * @param overwrite - If not set `true`, using a key that is already in the
     *   collection will throw. Otherwise, overwrites the previous value.
     */
    add(pair, overwrite) {
        let _pair;
        if (identity.isPair(pair))
            _pair = pair;
        else if (!pair || typeof pair !== 'object' || !('key' in pair)) {
            // In TypeScript, this never happens.
            _pair = new Pair.Pair(pair, pair?.value);
        }
        else
            _pair = new Pair.Pair(pair.key, pair.value);
        const prev = findPair(this.items, _pair.key);
        const sortEntries = this.schema?.sortMapEntries;
        if (prev) {
            if (!overwrite)
                throw new Error(`Key ${_pair.key} already set`);
            // For scalars, keep the old node & its comments and anchors
            if (identity.isScalar(prev.value) && Scalar.isScalarValue(_pair.value))
                prev.value.value = _pair.value;
            else
                prev.value = _pair.value;
        }
        else if (sortEntries) {
            const i = this.items.findIndex(item => sortEntries(_pair, item) < 0);
            if (i === -1)
                this.items.push(_pair);
            else
                this.items.splice(i, 0, _pair);
        }
        else {
            this.items.push(_pair);
        }
    }
    delete(key) {
        const it = findPair(this.items, key);
        if (!it)
            return false;
        const del = this.items.splice(this.items.indexOf(it), 1);
        return del.length > 0;
    }
    get(key, keepScalar) {
        const it = findPair(this.items, key);
        const node = it?.value;
        return (!keepScalar && identity.isScalar(node) ? node.value : node) ?? undefined;
    }
    has(key) {
        return !!findPair(this.items, key);
    }
    set(key, value) {
        this.add(new Pair.Pair(key, value), true);
    }
    /**
     * @param ctx - Conversion context, originally set in Document#toJS()
     * @param {Class} Type - If set, forces the returned collection type
     * @returns Instance of Type, Map, or Object
     */
    toJSON(_, ctx, Type) {
        const map = Type ? new Type() : ctx?.mapAsMap ? new Map() : {};
        if (ctx?.onCreate)
            ctx.onCreate(map);
        for (const item of this.items)
            addPairToJSMap.addPairToJSMap(ctx, map, item);
        return map;
    }
    toString(ctx, onComment, onChompKeep) {
        if (!ctx)
            return JSON.stringify(this);
        for (const item of this.items) {
            if (!identity.isPair(item))
                throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
        }
        if (!ctx.allNullValues && this.hasAllNullValues(false))
            ctx = Object.assign({}, ctx, { allNullValues: true });
        return stringifyCollection.stringifyCollection(this, ctx, {
            blockItemPrefix: '',
            flowChars: { start: '{', end: '}' },
            itemIndent: ctx.indent || '',
            onChompKeep,
            onComment
        });
    }
}

exports.YAMLMap = YAMLMap;
exports.findPair = findPair;


/***/ }),

/***/ 2223:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var createNode = __nccwpck_require__(2404);
var stringifyCollection = __nccwpck_require__(1212);
var Collection = __nccwpck_require__(101);
var identity = __nccwpck_require__(1127);
var Scalar = __nccwpck_require__(3301);
var toJS = __nccwpck_require__(4043);

class YAMLSeq extends Collection.Collection {
    static get tagName() {
        return 'tag:yaml.org,2002:seq';
    }
    constructor(schema) {
        super(identity.SEQ, schema);
        this.items = [];
    }
    add(value) {
        this.items.push(value);
    }
    /**
     * Removes a value from the collection.
     *
     * `key` must contain a representation of an integer for this to succeed.
     * It may be wrapped in a `Scalar`.
     *
     * @returns `true` if the item was found and removed.
     */
    delete(key) {
        const idx = asItemIndex(key);
        if (typeof idx !== 'number')
            return false;
        const del = this.items.splice(idx, 1);
        return del.length > 0;
    }
    get(key, keepScalar) {
        const idx = asItemIndex(key);
        if (typeof idx !== 'number')
            return undefined;
        const it = this.items[idx];
        return !keepScalar && identity.isScalar(it) ? it.value : it;
    }
    /**
     * Checks if the collection includes a value with the key `key`.
     *
     * `key` must contain a representation of an integer for this to succeed.
     * It may be wrapped in a `Scalar`.
     */
    has(key) {
        const idx = asItemIndex(key);
        return typeof idx === 'number' && idx < this.items.length;
    }
    /**
     * Sets a value in this collection. For `!!set`, `value` needs to be a
     * boolean to add/remove the item from the set.
     *
     * If `key` does not contain a representation of an integer, this will throw.
     * It may be wrapped in a `Scalar`.
     */
    set(key, value) {
        const idx = asItemIndex(key);
        if (typeof idx !== 'number')
            throw new Error(`Expected a valid index, not ${key}.`);
        const prev = this.items[idx];
        if (identity.isScalar(prev) && Scalar.isScalarValue(value))
            prev.value = value;
        else
            this.items[idx] = value;
    }
    toJSON(_, ctx) {
        const seq = [];
        if (ctx?.onCreate)
            ctx.onCreate(seq);
        let i = 0;
        for (const item of this.items)
            seq.push(toJS.toJS(item, String(i++), ctx));
        return seq;
    }
    toString(ctx, onComment, onChompKeep) {
        if (!ctx)
            return JSON.stringify(this);
        return stringifyCollection.stringifyCollection(this, ctx, {
            blockItemPrefix: '- ',
            flowChars: { start: '[', end: ']' },
            itemIndent: (ctx.indent || '') + '  ',
            onChompKeep,
            onComment
        });
    }
    static from(schema, obj, ctx) {
        const { replacer } = ctx;
        const seq = new this(schema);
        if (obj && Symbol.iterator in Object(obj)) {
            let i = 0;
            for (let it of obj) {
                if (typeof replacer === 'function') {
                    const key = obj instanceof Set ? it : String(i++);
                    it = replacer.call(obj, key, it);
                }
                seq.items.push(createNode.createNode(it, undefined, ctx));
            }
        }
        return seq;
    }
}
function asItemIndex(key) {
    let idx = identity.isScalar(key) ? key.value : key;
    if (idx && typeof idx === 'string')
        idx = Number(idx);
    return typeof idx === 'number' && Number.isInteger(idx) && idx >= 0
        ? idx
        : null;
}

exports.YAMLSeq = YAMLSeq;


/***/ }),

/***/ 7104:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var log = __nccwpck_require__(7249);
var merge = __nccwpck_require__(452);
var stringify = __nccwpck_require__(2148);
var identity = __nccwpck_require__(1127);
var toJS = __nccwpck_require__(4043);

function addPairToJSMap(ctx, map, { key, value }) {
    if (identity.isNode(key) && key.addToJSMap)
        key.addToJSMap(ctx, map, value);
    // TODO: Should drop this special case for bare << handling
    else if (merge.isMergeKey(ctx, key))
        merge.addMergeToJSMap(ctx, map, value);
    else {
        const jsKey = toJS.toJS(key, '', ctx);
        if (map instanceof Map) {
            map.set(jsKey, toJS.toJS(value, jsKey, ctx));
        }
        else if (map instanceof Set) {
            map.add(jsKey);
        }
        else {
            const stringKey = stringifyKey(key, jsKey, ctx);
            const jsValue = toJS.toJS(value, stringKey, ctx);
            if (stringKey in map)
                Object.defineProperty(map, stringKey, {
                    value: jsValue,
                    writable: true,
                    enumerable: true,
                    configurable: true
                });
            else
                map[stringKey] = jsValue;
        }
    }
    return map;
}
function stringifyKey(key, jsKey, ctx) {
    if (jsKey === null)
        return '';
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    if (typeof jsKey !== 'object')
        return String(jsKey);
    if (identity.isNode(key) && ctx?.doc) {
        const strCtx = stringify.createStringifyContext(ctx.doc, {});
        strCtx.anchors = new Set();
        for (const node of ctx.anchors.keys())
            strCtx.anchors.add(node.anchor);
        strCtx.inFlow = true;
        strCtx.inStringifyKey = true;
        const strKey = key.toString(strCtx);
        if (!ctx.mapKeyWarned) {
            let jsonStr = JSON.stringify(strKey);
            if (jsonStr.length > 40)
                jsonStr = jsonStr.substring(0, 36) + '..."';
            log.warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
            ctx.mapKeyWarned = true;
        }
        return strKey;
    }
    return JSON.stringify(jsKey);
}

exports.addPairToJSMap = addPairToJSMap;


/***/ }),

/***/ 1127:
/***/ ((__unused_webpack_module, exports) => {



const ALIAS = Symbol.for('yaml.alias');
const DOC = Symbol.for('yaml.document');
const MAP = Symbol.for('yaml.map');
const PAIR = Symbol.for('yaml.pair');
const SCALAR = Symbol.for('yaml.scalar');
const SEQ = Symbol.for('yaml.seq');
const NODE_TYPE = Symbol.for('yaml.node.type');
const isAlias = (node) => !!node && typeof node === 'object' && node[NODE_TYPE] === ALIAS;
const isDocument = (node) => !!node && typeof node === 'object' && node[NODE_TYPE] === DOC;
const isMap = (node) => !!node && typeof node === 'object' && node[NODE_TYPE] === MAP;
const isPair = (node) => !!node && typeof node === 'object' && node[NODE_TYPE] === PAIR;
const isScalar = (node) => !!node && typeof node === 'object' && node[NODE_TYPE] === SCALAR;
const isSeq = (node) => !!node && typeof node === 'object' && node[NODE_TYPE] === SEQ;
function isCollection(node) {
    if (node && typeof node === 'object')
        switch (node[NODE_TYPE]) {
            case MAP:
            case SEQ:
                return true;
        }
    return false;
}
function isNode(node) {
    if (node && typeof node === 'object')
        switch (node[NODE_TYPE]) {
            case ALIAS:
            case MAP:
            case SCALAR:
            case SEQ:
                return true;
        }
    return false;
}
const hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;

exports.ALIAS = ALIAS;
exports.DOC = DOC;
exports.MAP = MAP;
exports.NODE_TYPE = NODE_TYPE;
exports.PAIR = PAIR;
exports.SCALAR = SCALAR;
exports.SEQ = SEQ;
exports.hasAnchor = hasAnchor;
exports.isAlias = isAlias;
exports.isCollection = isCollection;
exports.isDocument = isDocument;
exports.isMap = isMap;
exports.isNode = isNode;
exports.isPair = isPair;
exports.isScalar = isScalar;
exports.isSeq = isSeq;


/***/ }),

/***/ 4043:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var identity = __nccwpck_require__(1127);

/**
 * Recursively convert any node or its contents to native JavaScript
 *
 * @param value - The input value
 * @param arg - If `value` defines a `toJSON()` method, use this
 *   as its first argument
 * @param ctx - Conversion context, originally set in Document#toJS(). If
 *   `{ keep: true }` is not set, output should be suitable for JSON
 *   stringification.
 */
function toJS(value, arg, ctx) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    if (Array.isArray(value))
        return value.map((v, i) => toJS(v, String(i), ctx));
    if (value && typeof value.toJSON === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        if (!ctx || !identity.hasAnchor(value))
            return value.toJSON(arg, ctx);
        const data = { aliasCount: 0, count: 1, res: undefined };
        ctx.anchors.set(value, data);
        ctx.onCreate = res => {
            data.res = res;
            delete ctx.onCreate;
        };
        const res = value.toJSON(arg, ctx);
        if (ctx.onCreate)
            ctx.onCreate(res);
        return res;
    }
    if (typeof value === 'bigint' && !ctx?.keep)
        return Number(value);
    return value;
}

exports.toJS = toJS;


/***/ }),

/***/ 110:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var resolveBlockScalar = __nccwpck_require__(8913);
var resolveFlowScalar = __nccwpck_require__(6842);
var errors = __nccwpck_require__(1464);
var stringifyString = __nccwpck_require__(3069);

function resolveAsScalar(token, strict = true, onError) {
    if (token) {
        const _onError = (pos, code, message) => {
            const offset = typeof pos === 'number' ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
            if (onError)
                onError(offset, code, message);
            else
                throw new errors.YAMLParseError([offset, offset + 1], code, message);
        };
        switch (token.type) {
            case 'scalar':
            case 'single-quoted-scalar':
            case 'double-quoted-scalar':
                return resolveFlowScalar.resolveFlowScalar(token, strict, _onError);
            case 'block-scalar':
                return resolveBlockScalar.resolveBlockScalar({ options: { strict } }, token, _onError);
        }
    }
    return null;
}
/**
 * Create a new scalar token with `value`
 *
 * Values that represent an actual string but may be parsed as a different type should use a `type` other than `'PLAIN'`,
 * as this function does not support any schema operations and won't check for such conflicts.
 *
 * @param value The string representation of the value, which will have its content properly indented.
 * @param context.end Comments and whitespace after the end of the value, or after the block scalar header. If undefined, a newline will be added.
 * @param context.implicitKey Being within an implicit key may affect the resolved type of the token's value.
 * @param context.indent The indent level of the token.
 * @param context.inFlow Is this scalar within a flow collection? This may affect the resolved type of the token's value.
 * @param context.offset The offset position of the token.
 * @param context.type The preferred type of the scalar token. If undefined, the previous type of the `token` will be used, defaulting to `'PLAIN'`.
 */
function createScalarToken(value, context) {
    const { implicitKey = false, indent, inFlow = false, offset = -1, type = 'PLAIN' } = context;
    const source = stringifyString.stringifyString({ type, value }, {
        implicitKey,
        indent: indent > 0 ? ' '.repeat(indent) : '',
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
    });
    const end = context.end ?? [
        { type: 'newline', offset: -1, indent, source: '\n' }
    ];
    switch (source[0]) {
        case '|':
        case '>': {
            const he = source.indexOf('\n');
            const head = source.substring(0, he);
            const body = source.substring(he + 1) + '\n';
            const props = [
                { type: 'block-scalar-header', offset, indent, source: head }
            ];
            if (!addEndtoBlockProps(props, end))
                props.push({ type: 'newline', offset: -1, indent, source: '\n' });
            return { type: 'block-scalar', offset, indent, props, source: body };
        }
        case '"':
            return { type: 'double-quoted-scalar', offset, indent, source, end };
        case "'":
            return { type: 'single-quoted-scalar', offset, indent, source, end };
        default:
            return { type: 'scalar', offset, indent, source, end };
    }
}
/**
 * Set the value of `token` to the given string `value`, overwriting any previous contents and type that it may have.
 *
 * Best efforts are made to retain any comments previously associated with the `token`,
 * though all contents within a collection's `items` will be overwritten.
 *
 * Values that represent an actual string but may be parsed as a different type should use a `type` other than `'PLAIN'`,
 * as this function does not support any schema operations and won't check for such conflicts.
 *
 * @param token Any token. If it does not include an `indent` value, the value will be stringified as if it were an implicit key.
 * @param value The string representation of the value, which will have its content properly indented.
 * @param context.afterKey In most cases, values after a key should have an additional level of indentation.
 * @param context.implicitKey Being within an implicit key may affect the resolved type of the token's value.
 * @param context.inFlow Being within a flow collection may affect the resolved type of the token's value.
 * @param context.type The preferred type of the scalar token. If undefined, the previous type of the `token` will be used, defaulting to `'PLAIN'`.
 */
function setScalarValue(token, value, context = {}) {
    let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
    let indent = 'indent' in token ? token.indent : null;
    if (afterKey && typeof indent === 'number')
        indent += 2;
    if (!type)
        switch (token.type) {
            case 'single-quoted-scalar':
                type = 'QUOTE_SINGLE';
                break;
            case 'double-quoted-scalar':
                type = 'QUOTE_DOUBLE';
                break;
            case 'block-scalar': {
                const header = token.props[0];
                if (header.type !== 'block-scalar-header')
                    throw new Error('Invalid block scalar header');
                type = header.source[0] === '>' ? 'BLOCK_FOLDED' : 'BLOCK_LITERAL';
                break;
            }
            default:
                type = 'PLAIN';
        }
    const source = stringifyString.stringifyString({ type, value }, {
        implicitKey: implicitKey || indent === null,
        indent: indent !== null && indent > 0 ? ' '.repeat(indent) : '',
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
    });
    switch (source[0]) {
        case '|':
        case '>':
            setBlockScalarValue(token, source);
            break;
        case '"':
            setFlowScalarValue(token, source, 'double-quoted-scalar');
            break;
        case "'":
            setFlowScalarValue(token, source, 'single-quoted-scalar');
            break;
        default:
            setFlowScalarValue(token, source, 'scalar');
    }
}
function setBlockScalarValue(token, source) {
    const he = source.indexOf('\n');
    const head = source.substring(0, he);
    const body = source.substring(he + 1) + '\n';
    if (token.type === 'block-scalar') {
        const header = token.props[0];
        if (header.type !== 'block-scalar-header')
            throw new Error('Invalid block scalar header');
        header.source = head;
        token.source = body;
    }
    else {
        const { offset } = token;
        const indent = 'indent' in token ? token.indent : -1;
        const props = [
            { type: 'block-scalar-header', offset, indent, source: head }
        ];
        if (!addEndtoBlockProps(props, 'end' in token ? token.end : undefined))
            props.push({ type: 'newline', offset: -1, indent, source: '\n' });
        for (const key of Object.keys(token))
            if (key !== 'type' && key !== 'offset')
                delete token[key];
        Object.assign(token, { type: 'block-scalar', indent, props, source: body });
    }
}
/** @returns `true` if last token is a newline */
function addEndtoBlockProps(props, end) {
    if (end)
        for (const st of end)
            switch (st.type) {
                case 'space':
                case 'comment':
                    props.push(st);
                    break;
                case 'newline':
                    props.push(st);
                    return true;
            }
    return false;
}
function setFlowScalarValue(token, source, type) {
    switch (token.type) {
        case 'scalar':
        case 'double-quoted-scalar':
        case 'single-quoted-scalar':
            token.type = type;
            token.source = source;
            break;
        case 'block-scalar': {
            const end = token.props.slice(1);
            let oa = source.length;
            if (token.props[0].type === 'block-scalar-header')
                oa -= token.props[0].source.length;
            for (const tok of end)
                tok.offset += oa;
            delete token.props;
            Object.assign(token, { type, source, end });
            break;
        }
        case 'block-map':
        case 'block-seq': {
            const offset = token.offset + source.length;
            const nl = { type: 'newline', offset, indent: token.indent, source: '\n' };
            delete token.items;
            Object.assign(token, { type, source, end: [nl] });
            break;
        }
        default: {
            const indent = 'indent' in token ? token.indent : -1;
            const end = 'end' in token && Array.isArray(token.end)
                ? token.end.filter(st => st.type === 'space' ||
                    st.type === 'comment' ||
                    st.type === 'newline')
                : [];
            for (const key of Object.keys(token))
                if (key !== 'type' && key !== 'offset')
                    delete token[key];
            Object.assign(token, { type, indent, source, end });
        }
    }
}

exports.createScalarToken = createScalarToken;
exports.resolveAsScalar = resolveAsScalar;
exports.setScalarValue = setScalarValue;


/***/ }),

/***/ 1733:
/***/ ((__unused_webpack_module, exports) => {



/**
 * Stringify a CST document, token, or collection item
 *
 * Fair warning: This applies no validation whatsoever, and
 * simply concatenates the sources in their logical order.
 */
const stringify = (cst) => 'type' in cst ? stringifyToken(cst) : stringifyItem(cst);
function stringifyToken(token) {
    switch (token.type) {
        case 'block-scalar': {
            let res = '';
            for (const tok of token.props)
                res += stringifyToken(tok);
            return res + token.source;
        }
        case 'block-map':
        case 'block-seq': {
            let res = '';
            for (const item of token.items)
                res += stringifyItem(item);
            return res;
        }
        case 'flow-collection': {
            let res = token.start.source;
            for (const item of token.items)
                res += stringifyItem(item);
            for (const st of token.end)
                res += st.source;
            return res;
        }
        case 'document': {
            let res = stringifyItem(token);
            if (token.end)
                for (const st of token.end)
                    res += st.source;
            return res;
        }
        default: {
            let res = token.source;
            if ('end' in token && token.end)
                for (const st of token.end)
                    res += st.source;
            return res;
        }
    }
}
function stringifyItem({ start, key, sep, value }) {
    let res = '';
    for (const st of start)
        res += st.source;
    if (key)
        res += stringifyToken(key);
    if (sep)
        for (const st of sep)
            res += st.source;
    if (value)
        res += stringifyToken(value);
    return res;
}

exports.stringify = stringify;


/***/ }),

/***/ 7715:
/***/ ((__unused_webpack_module, exports) => {



const BREAK = Symbol('break visit');
const SKIP = Symbol('skip children');
const REMOVE = Symbol('remove item');
/**
 * Apply a visitor to a CST document or item.
 *
 * Walks through the tree (depth-first) starting from the root, calling a
 * `visitor` function with two arguments when entering each item:
 *   - `item`: The current item, which included the following members:
 *     - `start: SourceToken[]` – Source tokens before the key or value,
 *       possibly including its anchor or tag.
 *     - `key?: Token | null` – Set for pair values. May then be `null`, if
 *       the key before the `:` separator is empty.
 *     - `sep?: SourceToken[]` – Source tokens between the key and the value,
 *       which should include the `:` map value indicator if `value` is set.
 *     - `value?: Token` – The value of a sequence item, or of a map pair.
 *   - `path`: The steps from the root to the current node, as an array of
 *     `['key' | 'value', number]` tuples.
 *
 * The return value of the visitor may be used to control the traversal:
 *   - `undefined` (default): Do nothing and continue
 *   - `visit.SKIP`: Do not visit the children of this token, continue with
 *      next sibling
 *   - `visit.BREAK`: Terminate traversal completely
 *   - `visit.REMOVE`: Remove the current item, then continue with the next one
 *   - `number`: Set the index of the next step. This is useful especially if
 *     the index of the current token has changed.
 *   - `function`: Define the next visitor for this item. After the original
 *     visitor is called on item entry, next visitors are called after handling
 *     a non-empty `key` and when exiting the item.
 */
function visit(cst, visitor) {
    if ('type' in cst && cst.type === 'document')
        cst = { start: cst.start, value: cst.value };
    _visit(Object.freeze([]), cst, visitor);
}
// Without the `as symbol` casts, TS declares these in the `visit`
// namespace using `var`, but then complains about that because
// `unique symbol` must be `const`.
/** Terminate visit traversal completely */
visit.BREAK = BREAK;
/** Do not visit the children of the current item */
visit.SKIP = SKIP;
/** Remove the current item */
visit.REMOVE = REMOVE;
/** Find the item at `path` from `cst` as the root */
visit.itemAtPath = (cst, path) => {
    let item = cst;
    for (const [field, index] of path) {
        const tok = item?.[field];
        if (tok && 'items' in tok) {
            item = tok.items[index];
        }
        else
            return undefined;
    }
    return item;
};
/**
 * Get the immediate parent collection of the item at `path` from `cst` as the root.
 *
 * Throws an error if the collection is not found, which should never happen if the item itself exists.
 */
visit.parentCollection = (cst, path) => {
    const parent = visit.itemAtPath(cst, path.slice(0, -1));
    const field = path[path.length - 1][0];
    const coll = parent?.[field];
    if (coll && 'items' in coll)
        return coll;
    throw new Error('Parent collection not found');
};
function _visit(path, item, visitor) {
    let ctrl = visitor(item, path);
    if (typeof ctrl === 'symbol')
        return ctrl;
    for (const field of ['key', 'value']) {
        const token = item[field];
        if (token && 'items' in token) {
            for (let i = 0; i < token.items.length; ++i) {
                const ci = _visit(Object.freeze(path.concat([[field, i]])), token.items[i], visitor);
                if (typeof ci === 'number')
                    i = ci - 1;
                else if (ci === BREAK)
                    return BREAK;
                else if (ci === REMOVE) {
                    token.items.splice(i, 1);
                    i -= 1;
                }
            }
            if (typeof ctrl === 'function' && field === 'key')
                ctrl = ctrl(item, path);
        }
    }
    return typeof ctrl === 'function' ? ctrl(item, path) : ctrl;
}

exports.visit = visit;


/***/ }),

/***/ 3461:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var cstScalar = __nccwpck_require__(110);
var cstStringify = __nccwpck_require__(1733);
var cstVisit = __nccwpck_require__(7715);

/** The byte order mark */
const BOM = '\u{FEFF}';
/** Start of doc-mode */
const DOCUMENT = '\x02'; // C0: Start of Text
/** Unexpected end of flow-mode */
const FLOW_END = '\x18'; // C0: Cancel
/** Next token is a scalar value */
const SCALAR = '\x1f'; // C0: Unit Separator
/** @returns `true` if `token` is a flow or block collection */
const isCollection = (token) => !!token && 'items' in token;
/** @returns `true` if `token` is a flow or block scalar; not an alias */
const isScalar = (token) => !!token &&
    (token.type === 'scalar' ||
        token.type === 'single-quoted-scalar' ||
        token.type === 'double-quoted-scalar' ||
        token.type === 'block-scalar');
/* istanbul ignore next */
/** Get a printable representation of a lexer token */
function prettyToken(token) {
    switch (token) {
        case BOM:
            return '<BOM>';
        case DOCUMENT:
            return '<DOC>';
        case FLOW_END:
            return '<FLOW_END>';
        case SCALAR:
            return '<SCALAR>';
        default:
            return JSON.stringify(token);
    }
}
/** Identify the type of a lexer token. May return `null` for unknown tokens. */
function tokenType(source) {
    switch (source) {
        case BOM:
            return 'byte-order-mark';
        case DOCUMENT:
            return 'doc-mode';
        case FLOW_END:
            return 'flow-error-end';
        case SCALAR:
            return 'scalar';
        case '---':
            return 'doc-start';
        case '...':
            return 'doc-end';
        case '':
        case '\n':
        case '\r\n':
            return 'newline';
        case '-':
            return 'seq-item-ind';
        case '?':
            return 'explicit-key-ind';
        case ':':
            return 'map-value-ind';
        case '{':
            return 'flow-map-start';
        case '}':
            return 'flow-map-end';
        case '[':
            return 'flow-seq-start';
        case ']':
            return 'flow-seq-end';
        case ',':
            return 'comma';
    }
    switch (source[0]) {
        case ' ':
        case '\t':
            return 'space';
        case '#':
            return 'comment';
        case '%':
            return 'directive-line';
        case '*':
            return 'alias';
        case '&':
            return 'anchor';
        case '!':
            return 'tag';
        case "'":
            return 'single-quoted-scalar';
        case '"':
            return 'double-quoted-scalar';
        case '|':
        case '>':
            return 'block-scalar-header';
    }
    return null;
}

exports.createScalarToken = cstScalar.createScalarToken;
exports.resolveAsScalar = cstScalar.resolveAsScalar;
exports.setScalarValue = cstScalar.setScalarValue;
exports.stringify = cstStringify.stringify;
exports.visit = cstVisit.visit;
exports.BOM = BOM;
exports.DOCUMENT = DOCUMENT;
exports.FLOW_END = FLOW_END;
exports.SCALAR = SCALAR;
exports.isCollection = isCollection;
exports.isScalar = isScalar;
exports.prettyToken = prettyToken;
exports.tokenType = tokenType;


/***/ }),

/***/ 361:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var cst = __nccwpck_require__(3461);

/*
START -> stream

stream
  directive -> line-end -> stream
  indent + line-end -> stream
  [else] -> line-start

line-end
  comment -> line-end
  newline -> .
  input-end -> END

line-start
  doc-start -> doc
  doc-end -> stream
  [else] -> indent -> block-start

block-start
  seq-item-start -> block-start
  explicit-key-start -> block-start
  map-value-start -> block-start
  [else] -> doc

doc
  line-end -> line-start
  spaces -> doc
  anchor -> doc
  tag -> doc
  flow-start -> flow -> doc
  flow-end -> error -> doc
  seq-item-start -> error -> doc
  explicit-key-start -> error -> doc
  map-value-start -> doc
  alias -> doc
  quote-start -> quoted-scalar -> doc
  block-scalar-header -> line-end -> block-scalar(min) -> line-start
  [else] -> plain-scalar(false, min) -> doc

flow
  line-end -> flow
  spaces -> flow
  anchor -> flow
  tag -> flow
  flow-start -> flow -> flow
  flow-end -> .
  seq-item-start -> error -> flow
  explicit-key-start -> flow
  map-value-start -> flow
  alias -> flow
  quote-start -> quoted-scalar -> flow
  comma -> flow
  [else] -> plain-scalar(true, 0) -> flow

quoted-scalar
  quote-end -> .
  [else] -> quoted-scalar

block-scalar(min)
  newline + peek(indent < min) -> .
  [else] -> block-scalar(min)

plain-scalar(is-flow, min)
  scalar-end(is-flow) -> .
  peek(newline + (indent < min)) -> .
  [else] -> plain-scalar(min)
*/
function isEmpty(ch) {
    switch (ch) {
        case undefined:
        case ' ':
        case '\n':
        case '\r':
        case '\t':
            return true;
        default:
            return false;
    }
}
const hexDigits = new Set('0123456789ABCDEFabcdef');
const tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
const flowIndicatorChars = new Set(',[]{}');
const invalidAnchorChars = new Set(' ,[]{}\n\r\t');
const isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
/**
 * Splits an input string into lexical tokens, i.e. smaller strings that are
 * easily identifiable by `tokens.tokenType()`.
 *
 * Lexing starts always in a "stream" context. Incomplete input may be buffered
 * until a complete token can be emitted.
 *
 * In addition to slices of the original input, the following control characters
 * may also be emitted:
 *
 * - `\x02` (Start of Text): A document starts with the next token
 * - `\x18` (Cancel): Unexpected end of flow-mode (indicates an error)
 * - `\x1f` (Unit Separator): Next token is a scalar value
 * - `\u{FEFF}` (Byte order mark): Emitted separately outside documents
 */
class Lexer {
    constructor() {
        /**
         * Flag indicating whether the end of the current buffer marks the end of
         * all input
         */
        this.atEnd = false;
        /**
         * Explicit indent set in block scalar header, as an offset from the current
         * minimum indent, so e.g. set to 1 from a header `|2+`. Set to -1 if not
         * explicitly set.
         */
        this.blockScalarIndent = -1;
        /**
         * Block scalars that include a + (keep) chomping indicator in their header
         * include trailing empty lines, which are otherwise excluded from the
         * scalar's contents.
         */
        this.blockScalarKeep = false;
        /** Current input */
        this.buffer = '';
        /**
         * Flag noting whether the map value indicator : can immediately follow this
         * node within a flow context.
         */
        this.flowKey = false;
        /** Count of surrounding flow collection levels. */
        this.flowLevel = 0;
        /**
         * Minimum level of indentation required for next lines to be parsed as a
         * part of the current scalar value.
         */
        this.indentNext = 0;
        /** Indentation level of the current line. */
        this.indentValue = 0;
        /** Position of the next \n character. */
        this.lineEndPos = null;
        /** Stores the state of the lexer if reaching the end of incpomplete input */
        this.next = null;
        /** A pointer to `buffer`; the current position of the lexer. */
        this.pos = 0;
    }
    /**
     * Generate YAML tokens from the `source` string. If `incomplete`,
     * a part of the last line may be left as a buffer for the next call.
     *
     * @returns A generator of lexical tokens
     */
    *lex(source, incomplete = false) {
        if (source) {
            if (typeof source !== 'string')
                throw TypeError('source is not a string');
            this.buffer = this.buffer ? this.buffer + source : source;
            this.lineEndPos = null;
        }
        this.atEnd = !incomplete;
        let next = this.next ?? 'stream';
        while (next && (incomplete || this.hasChars(1)))
            next = yield* this.parseNext(next);
    }
    atLineEnd() {
        let i = this.pos;
        let ch = this.buffer[i];
        while (ch === ' ' || ch === '\t')
            ch = this.buffer[++i];
        if (!ch || ch === '#' || ch === '\n')
            return true;
        if (ch === '\r')
            return this.buffer[i + 1] === '\n';
        return false;
    }
    charAt(n) {
        return this.buffer[this.pos + n];
    }
    continueScalar(offset) {
        let ch = this.buffer[offset];
        if (this.indentNext > 0) {
            let indent = 0;
            while (ch === ' ')
                ch = this.buffer[++indent + offset];
            if (ch === '\r') {
                const next = this.buffer[indent + offset + 1];
                if (next === '\n' || (!next && !this.atEnd))
                    return offset + indent + 1;
            }
            return ch === '\n' || indent >= this.indentNext || (!ch && !this.atEnd)
                ? offset + indent
                : -1;
        }
        if (ch === '-' || ch === '.') {
            const dt = this.buffer.substr(offset, 3);
            if ((dt === '---' || dt === '...') && isEmpty(this.buffer[offset + 3]))
                return -1;
        }
        return offset;
    }
    getLine() {
        let end = this.lineEndPos;
        if (typeof end !== 'number' || (end !== -1 && end < this.pos)) {
            end = this.buffer.indexOf('\n', this.pos);
            this.lineEndPos = end;
        }
        if (end === -1)
            return this.atEnd ? this.buffer.substring(this.pos) : null;
        if (this.buffer[end - 1] === '\r')
            end -= 1;
        return this.buffer.substring(this.pos, end);
    }
    hasChars(n) {
        return this.pos + n <= this.buffer.length;
    }
    setNext(state) {
        this.buffer = this.buffer.substring(this.pos);
        this.pos = 0;
        this.lineEndPos = null;
        this.next = state;
        return null;
    }
    peek(n) {
        return this.buffer.substr(this.pos, n);
    }
    *parseNext(next) {
        switch (next) {
            case 'stream':
                return yield* this.parseStream();
            case 'line-start':
                return yield* this.parseLineStart();
            case 'block-start':
                return yield* this.parseBlockStart();
            case 'doc':
                return yield* this.parseDocument();
            case 'flow':
                return yield* this.parseFlowCollection();
            case 'quoted-scalar':
                return yield* this.parseQuotedScalar();
            case 'block-scalar':
                return yield* this.parseBlockScalar();
            case 'plain-scalar':
                return yield* this.parsePlainScalar();
        }
    }
    *parseStream() {
        let line = this.getLine();
        if (line === null)
            return this.setNext('stream');
        if (line[0] === cst.BOM) {
            yield* this.pushCount(1);
            line = line.substring(1);
        }
        if (line[0] === '%') {
            let dirEnd = line.length;
            let cs = line.indexOf('#');
            while (cs !== -1) {
                const ch = line[cs - 1];
                if (ch === ' ' || ch === '\t') {
                    dirEnd = cs - 1;
                    break;
                }
                else {
                    cs = line.indexOf('#', cs + 1);
                }
            }
            while (true) {
                const ch = line[dirEnd - 1];
                if (ch === ' ' || ch === '\t')
                    dirEnd -= 1;
                else
                    break;
            }
            const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
            yield* this.pushCount(line.length - n); // possible comment
            this.pushNewline();
            return 'stream';
        }
        if (this.atLineEnd()) {
            const sp = yield* this.pushSpaces(true);
            yield* this.pushCount(line.length - sp);
            yield* this.pushNewline();
            return 'stream';
        }
        yield cst.DOCUMENT;
        return yield* this.parseLineStart();
    }
    *parseLineStart() {
        const ch = this.charAt(0);
        if (!ch && !this.atEnd)
            return this.setNext('line-start');
        if (ch === '-' || ch === '.') {
            if (!this.atEnd && !this.hasChars(4))
                return this.setNext('line-start');
            const s = this.peek(3);
            if ((s === '---' || s === '...') && isEmpty(this.charAt(3))) {
                yield* this.pushCount(3);
                this.indentValue = 0;
                this.indentNext = 0;
                return s === '---' ? 'doc' : 'stream';
            }
        }
        this.indentValue = yield* this.pushSpaces(false);
        if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
            this.indentNext = this.indentValue;
        return yield* this.parseBlockStart();
    }
    *parseBlockStart() {
        const [ch0, ch1] = this.peek(2);
        if (!ch1 && !this.atEnd)
            return this.setNext('block-start');
        if ((ch0 === '-' || ch0 === '?' || ch0 === ':') && isEmpty(ch1)) {
            const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
            this.indentNext = this.indentValue + 1;
            this.indentValue += n;
            return yield* this.parseBlockStart();
        }
        return 'doc';
    }
    *parseDocument() {
        yield* this.pushSpaces(true);
        const line = this.getLine();
        if (line === null)
            return this.setNext('doc');
        let n = yield* this.pushIndicators();
        switch (line[n]) {
            case '#':
                yield* this.pushCount(line.length - n);
            // fallthrough
            case undefined:
                yield* this.pushNewline();
                return yield* this.parseLineStart();
            case '{':
            case '[':
                yield* this.pushCount(1);
                this.flowKey = false;
                this.flowLevel = 1;
                return 'flow';
            case '}':
            case ']':
                // this is an error
                yield* this.pushCount(1);
                return 'doc';
            case '*':
                yield* this.pushUntil(isNotAnchorChar);
                return 'doc';
            case '"':
            case "'":
                return yield* this.parseQuotedScalar();
            case '|':
            case '>':
                n += yield* this.parseBlockScalarHeader();
                n += yield* this.pushSpaces(true);
                yield* this.pushCount(line.length - n);
                yield* this.pushNewline();
                return yield* this.parseBlockScalar();
            default:
                return yield* this.parsePlainScalar();
        }
    }
    *parseFlowCollection() {
        let nl, sp;
        let indent = -1;
        do {
            nl = yield* this.pushNewline();
            if (nl > 0) {
                sp = yield* this.pushSpaces(false);
                this.indentValue = indent = sp;
            }
            else {
                sp = 0;
            }
            sp += yield* this.pushSpaces(true);
        } while (nl + sp > 0);
        const line = this.getLine();
        if (line === null)
            return this.setNext('flow');
        if ((indent !== -1 && indent < this.indentNext && line[0] !== '#') ||
            (indent === 0 &&
                (line.startsWith('---') || line.startsWith('...')) &&
                isEmpty(line[3]))) {
            // Allowing for the terminal ] or } at the same (rather than greater)
            // indent level as the initial [ or { is technically invalid, but
            // failing here would be surprising to users.
            const atFlowEndMarker = indent === this.indentNext - 1 &&
                this.flowLevel === 1 &&
                (line[0] === ']' || line[0] === '}');
            if (!atFlowEndMarker) {
                // this is an error
                this.flowLevel = 0;
                yield cst.FLOW_END;
                return yield* this.parseLineStart();
            }
        }
        let n = 0;
        while (line[n] === ',') {
            n += yield* this.pushCount(1);
            n += yield* this.pushSpaces(true);
            this.flowKey = false;
        }
        n += yield* this.pushIndicators();
        switch (line[n]) {
            case undefined:
                return 'flow';
            case '#':
                yield* this.pushCount(line.length - n);
                return 'flow';
            case '{':
            case '[':
                yield* this.pushCount(1);
                this.flowKey = false;
                this.flowLevel += 1;
                return 'flow';
            case '}':
            case ']':
                yield* this.pushCount(1);
                this.flowKey = true;
                this.flowLevel -= 1;
                return this.flowLevel ? 'flow' : 'doc';
            case '*':
                yield* this.pushUntil(isNotAnchorChar);
                return 'flow';
            case '"':
            case "'":
                this.flowKey = true;
                return yield* this.parseQuotedScalar();
            case ':': {
                const next = this.charAt(1);
                if (this.flowKey || isEmpty(next) || next === ',') {
                    this.flowKey = false;
                    yield* this.pushCount(1);
                    yield* this.pushSpaces(true);
                    return 'flow';
                }
            }
            // fallthrough
            default:
                this.flowKey = false;
                return yield* this.parsePlainScalar();
        }
    }
    *parseQuotedScalar() {
        const quote = this.charAt(0);
        let end = this.buffer.indexOf(quote, this.pos + 1);
        if (quote === "'") {
            while (end !== -1 && this.buffer[end + 1] === "'")
                end = this.buffer.indexOf("'", end + 2);
        }
        else {
            // double-quote
            while (end !== -1) {
                let n = 0;
                while (this.buffer[end - 1 - n] === '\\')
                    n += 1;
                if (n % 2 === 0)
                    break;
                end = this.buffer.indexOf('"', end + 1);
            }
        }
        // Only looking for newlines within the quotes
        const qb = this.buffer.substring(0, end);
        let nl = qb.indexOf('\n', this.pos);
        if (nl !== -1) {
            while (nl !== -1) {
                const cs = this.continueScalar(nl + 1);
                if (cs === -1)
                    break;
                nl = qb.indexOf('\n', cs);
            }
            if (nl !== -1) {
                // this is an error caused by an unexpected unindent
                end = nl - (qb[nl - 1] === '\r' ? 2 : 1);
            }
        }
        if (end === -1) {
            if (!this.atEnd)
                return this.setNext('quoted-scalar');
            end = this.buffer.length;
        }
        yield* this.pushToIndex(end + 1, false);
        return this.flowLevel ? 'flow' : 'doc';
    }
    *parseBlockScalarHeader() {
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        let i = this.pos;
        while (true) {
            const ch = this.buffer[++i];
            if (ch === '+')
                this.blockScalarKeep = true;
            else if (ch > '0' && ch <= '9')
                this.blockScalarIndent = Number(ch) - 1;
            else if (ch !== '-')
                break;
        }
        return yield* this.pushUntil(ch => isEmpty(ch) || ch === '#');
    }
    *parseBlockScalar() {
        let nl = this.pos - 1; // may be -1 if this.pos === 0
        let indent = 0;
        let ch;
        loop: for (let i = this.pos; (ch = this.buffer[i]); ++i) {
            switch (ch) {
                case ' ':
                    indent += 1;
                    break;
                case '\n':
                    nl = i;
                    indent = 0;
                    break;
                case '\r': {
                    const next = this.buffer[i + 1];
                    if (!next && !this.atEnd)
                        return this.setNext('block-scalar');
                    if (next === '\n')
                        break;
                } // fallthrough
                default:
                    break loop;
            }
        }
        if (!ch && !this.atEnd)
            return this.setNext('block-scalar');
        if (indent >= this.indentNext) {
            if (this.blockScalarIndent === -1)
                this.indentNext = indent;
            else {
                this.indentNext =
                    this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
            }
            do {
                const cs = this.continueScalar(nl + 1);
                if (cs === -1)
                    break;
                nl = this.buffer.indexOf('\n', cs);
            } while (nl !== -1);
            if (nl === -1) {
                if (!this.atEnd)
                    return this.setNext('block-scalar');
                nl = this.buffer.length;
            }
        }
        // Trailing insufficiently indented tabs are invalid.
        // To catch that during parsing, we include them in the block scalar value.
        let i = nl + 1;
        ch = this.buffer[i];
        while (ch === ' ')
            ch = this.buffer[++i];
        if (ch === '\t') {
            while (ch === '\t' || ch === ' ' || ch === '\r' || ch === '\n')
                ch = this.buffer[++i];
            nl = i - 1;
        }
        else if (!this.blockScalarKeep) {
            do {
                let i = nl - 1;
                let ch = this.buffer[i];
                if (ch === '\r')
                    ch = this.buffer[--i];
                const lastChar = i; // Drop the line if last char not more indented
                while (ch === ' ')
                    ch = this.buffer[--i];
                if (ch === '\n' && i >= this.pos && i + 1 + indent > lastChar)
                    nl = i;
                else
                    break;
            } while (true);
        }
        yield cst.SCALAR;
        yield* this.pushToIndex(nl + 1, true);
        return yield* this.parseLineStart();
    }
    *parsePlainScalar() {
        const inFlow = this.flowLevel > 0;
        let end = this.pos - 1;
        let i = this.pos - 1;
        let ch;
        while ((ch = this.buffer[++i])) {
            if (ch === ':') {
                const next = this.buffer[i + 1];
                if (isEmpty(next) || (inFlow && flowIndicatorChars.has(next)))
                    break;
                end = i;
            }
            else if (isEmpty(ch)) {
                let next = this.buffer[i + 1];
                if (ch === '\r') {
                    if (next === '\n') {
                        i += 1;
                        ch = '\n';
                        next = this.buffer[i + 1];
                    }
                    else
                        end = i;
                }
                if (next === '#' || (inFlow && flowIndicatorChars.has(next)))
                    break;
                if (ch === '\n') {
                    const cs = this.continueScalar(i + 1);
                    if (cs === -1)
                        break;
                    i = Math.max(i, cs - 2); // to advance, but still account for ' #'
                }
            }
            else {
                if (inFlow && flowIndicatorChars.has(ch))
                    break;
                end = i;
            }
        }
        if (!ch && !this.atEnd)
            return this.setNext('plain-scalar');
        yield cst.SCALAR;
        yield* this.pushToIndex(end + 1, true);
        return inFlow ? 'flow' : 'doc';
    }
    *pushCount(n) {
        if (n > 0) {
            yield this.buffer.substr(this.pos, n);
            this.pos += n;
            return n;
        }
        return 0;
    }
    *pushToIndex(i, allowEmpty) {
        const s = this.buffer.slice(this.pos, i);
        if (s) {
            yield s;
            this.pos += s.length;
            return s.length;
        }
        else if (allowEmpty)
            yield '';
        return 0;
    }
    *pushIndicators() {
        switch (this.charAt(0)) {
            case '!':
                return ((yield* this.pushTag()) +
                    (yield* this.pushSpaces(true)) +
                    (yield* this.pushIndicators()));
            case '&':
                return ((yield* this.pushUntil(isNotAnchorChar)) +
                    (yield* this.pushSpaces(true)) +
                    (yield* this.pushIndicators()));
            case '-': // this is an error
            case '?': // this is an error outside flow collections
            case ':': {
                const inFlow = this.flowLevel > 0;
                const ch1 = this.charAt(1);
                if (isEmpty(ch1) || (inFlow && flowIndicatorChars.has(ch1))) {
                    if (!inFlow)
                        this.indentNext = this.indentValue + 1;
                    else if (this.flowKey)
                        this.flowKey = false;
                    return ((yield* this.pushCount(1)) +
                        (yield* this.pushSpaces(true)) +
                        (yield* this.pushIndicators()));
                }
            }
        }
        return 0;
    }
    *pushTag() {
        if (this.charAt(1) === '<') {
            let i = this.pos + 2;
            let ch = this.buffer[i];
            while (!isEmpty(ch) && ch !== '>')
                ch = this.buffer[++i];
            return yield* this.pushToIndex(ch === '>' ? i + 1 : i, false);
        }
        else {
            let i = this.pos + 1;
            let ch = this.buffer[i];
            while (ch) {
                if (tagChars.has(ch))
                    ch = this.buffer[++i];
                else if (ch === '%' &&
                    hexDigits.has(this.buffer[i + 1]) &&
                    hexDigits.has(this.buffer[i + 2])) {
                    ch = this.buffer[(i += 3)];
                }
                else
                    break;
            }
            return yield* this.pushToIndex(i, false);
        }
    }
    *pushNewline() {
        const ch = this.buffer[this.pos];
        if (ch === '\n')
            return yield* this.pushCount(1);
        else if (ch === '\r' && this.charAt(1) === '\n')
            return yield* this.pushCount(2);
        else
            return 0;
    }
    *pushSpaces(allowTabs) {
        let i = this.pos - 1;
        let ch;
        do {
            ch = this.buffer[++i];
        } while (ch === ' ' || (allowTabs && ch === '\t'));
        const n = i - this.pos;
        if (n > 0) {
            yield this.buffer.substr(this.pos, n);
            this.pos = i;
        }
        return n;
    }
    *pushUntil(test) {
        let i = this.pos;
        let ch = this.buffer[i];
        while (!test(ch))
            ch = this.buffer[++i];
        return yield* this.pushToIndex(i, false);
    }
}

exports.Lexer = Lexer;


/***/ }),

/***/ 6628:
/***/ ((__unused_webpack_module, exports) => {



/**
 * Tracks newlines during parsing in order to provide an efficient API for
 * determining the one-indexed `{ line, col }` position for any offset
 * within the input.
 */
class LineCounter {
    constructor() {
        this.lineStarts = [];
        /**
         * Should be called in ascending order. Otherwise, call
         * `lineCounter.lineStarts.sort()` before calling `linePos()`.
         */
        this.addNewLine = (offset) => this.lineStarts.push(offset);
        /**
         * Performs a binary search and returns the 1-indexed { line, col }
         * position of `offset`. If `line === 0`, `addNewLine` has never been
         * called or `offset` is before the first known newline.
         */
        this.linePos = (offset) => {
            let low = 0;
            let high = this.lineStarts.length;
            while (low < high) {
                const mid = (low + high) >> 1; // Math.floor((low + high) / 2)
                if (this.lineStarts[mid] < offset)
                    low = mid + 1;
                else
                    high = mid;
            }
            if (this.lineStarts[low] === offset)
                return { line: low + 1, col: 1 };
            if (low === 0)
                return { line: 0, col: offset };
            const start = this.lineStarts[low - 1];
            return { line: low, col: offset - start + 1 };
        };
    }
}

exports.LineCounter = LineCounter;


/***/ }),

/***/ 3456:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var node_process = __nccwpck_require__(932);
var cst = __nccwpck_require__(3461);
var lexer = __nccwpck_require__(361);

function includesToken(list, type) {
    for (let i = 0; i < list.length; ++i)
        if (list[i].type === type)
            return true;
    return false;
}
function findNonEmptyIndex(list) {
    for (let i = 0; i < list.length; ++i) {
        switch (list[i].type) {
            case 'space':
            case 'comment':
            case 'newline':
                break;
            default:
                return i;
        }
    }
    return -1;
}
function isFlowToken(token) {
    switch (token?.type) {
        case 'alias':
        case 'scalar':
        case 'single-quoted-scalar':
        case 'double-quoted-scalar':
        case 'flow-collection':
            return true;
        default:
            return false;
    }
}
function getPrevProps(parent) {
    switch (parent.type) {
        case 'document':
            return parent.start;
        case 'block-map': {
            const it = parent.items[parent.items.length - 1];
            return it.sep ?? it.start;
        }
        case 'block-seq':
            return parent.items[parent.items.length - 1].start;
        /* istanbul ignore next should not happen */
        default:
            return [];
    }
}
/** Note: May modify input array */
function getFirstKeyStartProps(prev) {
    if (prev.length === 0)
        return [];
    let i = prev.length;
    loop: while (--i >= 0) {
        switch (prev[i].type) {
            case 'doc-start':
            case 'explicit-key-ind':
            case 'map-value-ind':
            case 'seq-item-ind':
            case 'newline':
                break loop;
        }
    }
    while (prev[++i]?.type === 'space') {
        /* loop */
    }
    return prev.splice(i, prev.length);
}
function fixFlowSeqItems(fc) {
    if (fc.start.type === 'flow-seq-start') {
        for (const it of fc.items) {
            if (it.sep &&
                !it.value &&
                !includesToken(it.start, 'explicit-key-ind') &&
                !includesToken(it.sep, 'map-value-ind')) {
                if (it.key)
                    it.value = it.key;
                delete it.key;
                if (isFlowToken(it.value)) {
                    if (it.value.end)
                        Array.prototype.push.apply(it.value.end, it.sep);
                    else
                        it.value.end = it.sep;
                }
                else
                    Array.prototype.push.apply(it.start, it.sep);
                delete it.sep;
            }
        }
    }
}
/**
 * A YAML concrete syntax tree (CST) parser
 *
 * ```ts
 * const src: string = ...
 * for (const token of new Parser().parse(src)) {
 *   // token: Token
 * }
 * ```
 *
 * To use the parser with a user-provided lexer:
 *
 * ```ts
 * function* parse(source: string, lexer: Lexer) {
 *   const parser = new Parser()
 *   for (const lexeme of lexer.lex(source))
 *     yield* parser.next(lexeme)
 *   yield* parser.end()
 * }
 *
 * const src: string = ...
 * const lexer = new Lexer()
 * for (const token of parse(src, lexer)) {
 *   // token: Token
 * }
 * ```
 */
class Parser {
    /**
     * @param onNewLine - If defined, called separately with the start position of
     *   each new line (in `parse()`, including the start of input).
     */
    constructor(onNewLine) {
        /** If true, space and sequence indicators count as indentation */
        this.atNewLine = true;
        /** If true, next token is a scalar value */
        this.atScalar = false;
        /** Current indentation level */
        this.indent = 0;
        /** Current offset since the start of parsing */
        this.offset = 0;
        /** On the same line with a block map key */
        this.onKeyLine = false;
        /** Top indicates the node that's currently being built */
        this.stack = [];
        /** The source of the current token, set in parse() */
        this.source = '';
        /** The type of the current token, set in parse() */
        this.type = '';
        // Must be defined after `next()`
        this.lexer = new lexer.Lexer();
        this.onNewLine = onNewLine;
    }
    /**
     * Parse `source` as a YAML stream.
     * If `incomplete`, a part of the last line may be left as a buffer for the next call.
     *
     * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
     *
     * @returns A generator of tokens representing each directive, document, and other structure.
     */
    *parse(source, incomplete = false) {
        if (this.onNewLine && this.offset === 0)
            this.onNewLine(0);
        for (const lexeme of this.lexer.lex(source, incomplete))
            yield* this.next(lexeme);
        if (!incomplete)
            yield* this.end();
    }
    /**
     * Advance the parser by the `source` of one lexical token.
     */
    *next(source) {
        this.source = source;
        if (node_process.env.LOG_TOKENS)
            console.log('|', cst.prettyToken(source));
        if (this.atScalar) {
            this.atScalar = false;
            yield* this.step();
            this.offset += source.length;
            return;
        }
        const type = cst.tokenType(source);
        if (!type) {
            const message = `Not a YAML token: ${source}`;
            yield* this.pop({ type: 'error', offset: this.offset, message, source });
            this.offset += source.length;
        }
        else if (type === 'scalar') {
            this.atNewLine = false;
            this.atScalar = true;
            this.type = 'scalar';
        }
        else {
            this.type = type;
            yield* this.step();
            switch (type) {
                case 'newline':
                    this.atNewLine = true;
                    this.indent = 0;
                    if (this.onNewLine)
                        this.onNewLine(this.offset + source.length);
                    break;
                case 'space':
                    if (this.atNewLine && source[0] === ' ')
                        this.indent += source.length;
                    break;
                case 'explicit-key-ind':
                case 'map-value-ind':
                case 'seq-item-ind':
                    if (this.atNewLine)
                        this.indent += source.length;
                    break;
                case 'doc-mode':
                case 'flow-error-end':
                    return;
                default:
                    this.atNewLine = false;
            }
            this.offset += source.length;
        }
    }
    /** Call at end of input to push out any remaining constructions */
    *end() {
        while (this.stack.length > 0)
            yield* this.pop();
    }
    get sourceToken() {
        const st = {
            type: this.type,
            offset: this.offset,
            indent: this.indent,
            source: this.source
        };
        return st;
    }
    *step() {
        const top = this.peek(1);
        if (this.type === 'doc-end' && top?.type !== 'doc-end') {
            while (this.stack.length > 0)
                yield* this.pop();
            this.stack.push({
                type: 'doc-end',
                offset: this.offset,
                source: this.source
            });
            return;
        }
        if (!top)
            return yield* this.stream();
        switch (top.type) {
            case 'document':
                return yield* this.document(top);
            case 'alias':
            case 'scalar':
            case 'single-quoted-scalar':
            case 'double-quoted-scalar':
                return yield* this.scalar(top);
            case 'block-scalar':
                return yield* this.blockScalar(top);
            case 'block-map':
                return yield* this.blockMap(top);
            case 'block-seq':
                return yield* this.blockSequence(top);
            case 'flow-collection':
                return yield* this.flowCollection(top);
            case 'doc-end':
                return yield* this.documentEnd(top);
        }
        /* istanbul ignore next should not happen */
        yield* this.pop();
    }
    peek(n) {
        return this.stack[this.stack.length - n];
    }
    *pop(error) {
        const token = error ?? this.stack.pop();
        /* istanbul ignore if should not happen */
        if (!token) {
            const message = 'Tried to pop an empty stack';
            yield { type: 'error', offset: this.offset, source: '', message };
        }
        else if (this.stack.length === 0) {
            yield token;
        }
        else {
            const top = this.peek(1);
            if (token.type === 'block-scalar') {
                // Block scalars use their parent rather than header indent
                token.indent = 'indent' in top ? top.indent : 0;
            }
            else if (token.type === 'flow-collection' && top.type === 'document') {
                // Ignore all indent for top-level flow collections
                token.indent = 0;
            }
            if (token.type === 'flow-collection')
                fixFlowSeqItems(token);
            switch (top.type) {
                case 'document':
                    top.value = token;
                    break;
                case 'block-scalar':
                    top.props.push(token); // error
                    break;
                case 'block-map': {
                    const it = top.items[top.items.length - 1];
                    if (it.value) {
                        top.items.push({ start: [], key: token, sep: [] });
                        this.onKeyLine = true;
                        return;
                    }
                    else if (it.sep) {
                        it.value = token;
                    }
                    else {
                        Object.assign(it, { key: token, sep: [] });
                        this.onKeyLine = !it.explicitKey;
                        return;
                    }
                    break;
                }
                case 'block-seq': {
                    const it = top.items[top.items.length - 1];
                    if (it.value)
                        top.items.push({ start: [], value: token });
                    else
                        it.value = token;
                    break;
                }
                case 'flow-collection': {
                    const it = top.items[top.items.length - 1];
                    if (!it || it.value)
                        top.items.push({ start: [], key: token, sep: [] });
                    else if (it.sep)
                        it.value = token;
                    else
                        Object.assign(it, { key: token, sep: [] });
                    return;
                }
                /* istanbul ignore next should not happen */
                default:
                    yield* this.pop();
                    yield* this.pop(token);
            }
            if ((top.type === 'document' ||
                top.type === 'block-map' ||
                top.type === 'block-seq') &&
                (token.type === 'block-map' || token.type === 'block-seq')) {
                const last = token.items[token.items.length - 1];
                if (last &&
                    !last.sep &&
                    !last.value &&
                    last.start.length > 0 &&
                    findNonEmptyIndex(last.start) === -1 &&
                    (token.indent === 0 ||
                        last.start.every(st => st.type !== 'comment' || st.indent < token.indent))) {
                    if (top.type === 'document')
                        top.end = last.start;
                    else
                        top.items.push({ start: last.start });
                    token.items.splice(-1, 1);
                }
            }
        }
    }
    *stream() {
        switch (this.type) {
            case 'directive-line':
                yield { type: 'directive', offset: this.offset, source: this.source };
                return;
            case 'byte-order-mark':
            case 'space':
            case 'comment':
            case 'newline':
                yield this.sourceToken;
                return;
            case 'doc-mode':
            case 'doc-start': {
                const doc = {
                    type: 'document',
                    offset: this.offset,
                    start: []
                };
                if (this.type === 'doc-start')
                    doc.start.push(this.sourceToken);
                this.stack.push(doc);
                return;
            }
        }
        yield {
            type: 'error',
            offset: this.offset,
            message: `Unexpected ${this.type} token in YAML stream`,
            source: this.source
        };
    }
    *document(doc) {
        if (doc.value)
            return yield* this.lineEnd(doc);
        switch (this.type) {
            case 'doc-start': {
                if (findNonEmptyIndex(doc.start) !== -1) {
                    yield* this.pop();
                    yield* this.step();
                }
                else
                    doc.start.push(this.sourceToken);
                return;
            }
            case 'anchor':
            case 'tag':
            case 'space':
            case 'comment':
            case 'newline':
                doc.start.push(this.sourceToken);
                return;
        }
        const bv = this.startBlockValue(doc);
        if (bv)
            this.stack.push(bv);
        else {
            yield {
                type: 'error',
                offset: this.offset,
                message: `Unexpected ${this.type} token in YAML document`,
                source: this.source
            };
        }
    }
    *scalar(scalar) {
        if (this.type === 'map-value-ind') {
            const prev = getPrevProps(this.peek(2));
            const start = getFirstKeyStartProps(prev);
            let sep;
            if (scalar.end) {
                sep = scalar.end;
                sep.push(this.sourceToken);
                delete scalar.end;
            }
            else
                sep = [this.sourceToken];
            const map = {
                type: 'block-map',
                offset: scalar.offset,
                indent: scalar.indent,
                items: [{ start, key: scalar, sep }]
            };
            this.onKeyLine = true;
            this.stack[this.stack.length - 1] = map;
        }
        else
            yield* this.lineEnd(scalar);
    }
    *blockScalar(scalar) {
        switch (this.type) {
            case 'space':
            case 'comment':
            case 'newline':
                scalar.props.push(this.sourceToken);
                return;
            case 'scalar':
                scalar.source = this.source;
                // block-scalar source includes trailing newline
                this.atNewLine = true;
                this.indent = 0;
                if (this.onNewLine) {
                    let nl = this.source.indexOf('\n') + 1;
                    while (nl !== 0) {
                        this.onNewLine(this.offset + nl);
                        nl = this.source.indexOf('\n', nl) + 1;
                    }
                }
                yield* this.pop();
                break;
            /* istanbul ignore next should not happen */
            default:
                yield* this.pop();
                yield* this.step();
        }
    }
    *blockMap(map) {
        const it = map.items[map.items.length - 1];
        // it.sep is true-ish if pair already has key or : separator
        switch (this.type) {
            case 'newline':
                this.onKeyLine = false;
                if (it.value) {
                    const end = 'end' in it.value ? it.value.end : undefined;
                    const last = Array.isArray(end) ? end[end.length - 1] : undefined;
                    if (last?.type === 'comment')
                        end?.push(this.sourceToken);
                    else
                        map.items.push({ start: [this.sourceToken] });
                }
                else if (it.sep) {
                    it.sep.push(this.sourceToken);
                }
                else {
                    it.start.push(this.sourceToken);
                }
                return;
            case 'space':
            case 'comment':
                if (it.value) {
                    map.items.push({ start: [this.sourceToken] });
                }
                else if (it.sep) {
                    it.sep.push(this.sourceToken);
                }
                else {
                    if (this.atIndentedComment(it.start, map.indent)) {
                        const prev = map.items[map.items.length - 2];
                        const end = prev?.value?.end;
                        if (Array.isArray(end)) {
                            Array.prototype.push.apply(end, it.start);
                            end.push(this.sourceToken);
                            map.items.pop();
                            return;
                        }
                    }
                    it.start.push(this.sourceToken);
                }
                return;
        }
        if (this.indent >= map.indent) {
            const atMapIndent = !this.onKeyLine && this.indent === map.indent;
            const atNextItem = atMapIndent &&
                (it.sep || it.explicitKey) &&
                this.type !== 'seq-item-ind';
            // For empty nodes, assign newline-separated not indented empty tokens to following node
            let start = [];
            if (atNextItem && it.sep && !it.value) {
                const nl = [];
                for (let i = 0; i < it.sep.length; ++i) {
                    const st = it.sep[i];
                    switch (st.type) {
                        case 'newline':
                            nl.push(i);
                            break;
                        case 'space':
                            break;
                        case 'comment':
                            if (st.indent > map.indent)
                                nl.length = 0;
                            break;
                        default:
                            nl.length = 0;
                    }
                }
                if (nl.length >= 2)
                    start = it.sep.splice(nl[1]);
            }
            switch (this.type) {
                case 'anchor':
                case 'tag':
                    if (atNextItem || it.value) {
                        start.push(this.sourceToken);
                        map.items.push({ start });
                        this.onKeyLine = true;
                    }
                    else if (it.sep) {
                        it.sep.push(this.sourceToken);
                    }
                    else {
                        it.start.push(this.sourceToken);
                    }
                    return;
                case 'explicit-key-ind':
                    if (!it.sep && !it.explicitKey) {
                        it.start.push(this.sourceToken);
                        it.explicitKey = true;
                    }
                    else if (atNextItem || it.value) {
                        start.push(this.sourceToken);
                        map.items.push({ start, explicitKey: true });
                    }
                    else {
                        this.stack.push({
                            type: 'block-map',
                            offset: this.offset,
                            indent: this.indent,
                            items: [{ start: [this.sourceToken], explicitKey: true }]
                        });
                    }
                    this.onKeyLine = true;
                    return;
                case 'map-value-ind':
                    if (it.explicitKey) {
                        if (!it.sep) {
                            if (includesToken(it.start, 'newline')) {
                                Object.assign(it, { key: null, sep: [this.sourceToken] });
                            }
                            else {
                                const start = getFirstKeyStartProps(it.start);
                                this.stack.push({
                                    type: 'block-map',
                                    offset: this.offset,
                                    indent: this.indent,
                                    items: [{ start, key: null, sep: [this.sourceToken] }]
                                });
                            }
                        }
                        else if (it.value) {
                            map.items.push({ start: [], key: null, sep: [this.sourceToken] });
                        }
                        else if (includesToken(it.sep, 'map-value-ind')) {
                            this.stack.push({
                                type: 'block-map',
                                offset: this.offset,
                                indent: this.indent,
                                items: [{ start, key: null, sep: [this.sourceToken] }]
                            });
                        }
                        else if (isFlowToken(it.key) &&
                            !includesToken(it.sep, 'newline')) {
                            const start = getFirstKeyStartProps(it.start);
                            const key = it.key;
                            const sep = it.sep;
                            sep.push(this.sourceToken);
                            // @ts-expect-error type guard is wrong here
                            delete it.key;
                            // @ts-expect-error type guard is wrong here
                            delete it.sep;
                            this.stack.push({
                                type: 'block-map',
                                offset: this.offset,
                                indent: this.indent,
                                items: [{ start, key, sep }]
                            });
                        }
                        else if (start.length > 0) {
                            // Not actually at next item
                            it.sep = it.sep.concat(start, this.sourceToken);
                        }
                        else {
                            it.sep.push(this.sourceToken);
                        }
                    }
                    else {
                        if (!it.sep) {
                            Object.assign(it, { key: null, sep: [this.sourceToken] });
                        }
                        else if (it.value || atNextItem) {
                            map.items.push({ start, key: null, sep: [this.sourceToken] });
                        }
                        else if (includesToken(it.sep, 'map-value-ind')) {
                            this.stack.push({
                                type: 'block-map',
                                offset: this.offset,
                                indent: this.indent,
                                items: [{ start: [], key: null, sep: [this.sourceToken] }]
                            });
                        }
                        else {
                            it.sep.push(this.sourceToken);
                        }
                    }
                    this.onKeyLine = true;
                    return;
                case 'alias':
                case 'scalar':
                case 'single-quoted-scalar':
                case 'double-quoted-scalar': {
                    const fs = this.flowScalar(this.type);
                    if (atNextItem || it.value) {
                        map.items.push({ start, key: fs, sep: [] });
                        this.onKeyLine = true;
                    }
                    else if (it.sep) {
                        this.stack.push(fs);
                    }
                    else {
                        Object.assign(it, { key: fs, sep: [] });
                        this.onKeyLine = true;
                    }
                    return;
                }
                default: {
                    const bv = this.startBlockValue(map);
                    if (bv) {
                        if (bv.type === 'block-seq') {
                            if (!it.explicitKey &&
                                it.sep &&
                                !includesToken(it.sep, 'newline')) {
                                yield* this.pop({
                                    type: 'error',
                                    offset: this.offset,
                                    message: 'Unexpected block-seq-ind on same line with key',
                                    source: this.source
                                });
                                return;
                            }
                        }
                        else if (atMapIndent) {
                            map.items.push({ start });
                        }
                        this.stack.push(bv);
                        return;
                    }
                }
            }
        }
        yield* this.pop();
        yield* this.step();
    }
    *blockSequence(seq) {
        const it = seq.items[seq.items.length - 1];
        switch (this.type) {
            case 'newline':
                if (it.value) {
                    const end = 'end' in it.value ? it.value.end : undefined;
                    const last = Array.isArray(end) ? end[end.length - 1] : undefined;
                    if (last?.type === 'comment')
                        end?.push(this.sourceToken);
                    else
                        seq.items.push({ start: [this.sourceToken] });
                }
                else
                    it.start.push(this.sourceToken);
                return;
            case 'space':
            case 'comment':
                if (it.value)
                    seq.items.push({ start: [this.sourceToken] });
                else {
                    if (this.atIndentedComment(it.start, seq.indent)) {
                        const prev = seq.items[seq.items.length - 2];
                        const end = prev?.value?.end;
                        if (Array.isArray(end)) {
                            Array.prototype.push.apply(end, it.start);
                            end.push(this.sourceToken);
                            seq.items.pop();
                            return;
                        }
                    }
                    it.start.push(this.sourceToken);
                }
                return;
            case 'anchor':
            case 'tag':
                if (it.value || this.indent <= seq.indent)
                    break;
                it.start.push(this.sourceToken);
                return;
            case 'seq-item-ind':
                if (this.indent !== seq.indent)
                    break;
                if (it.value || includesToken(it.start, 'seq-item-ind'))
                    seq.items.push({ start: [this.sourceToken] });
                else
                    it.start.push(this.sourceToken);
                return;
        }
        if (this.indent > seq.indent) {
            const bv = this.startBlockValue(seq);
            if (bv) {
                this.stack.push(bv);
                return;
            }
        }
        yield* this.pop();
        yield* this.step();
    }
    *flowCollection(fc) {
        const it = fc.items[fc.items.length - 1];
        if (this.type === 'flow-error-end') {
            let top;
            do {
                yield* this.pop();
                top = this.peek(1);
            } while (top?.type === 'flow-collection');
        }
        else if (fc.end.length === 0) {
            switch (this.type) {
                case 'comma':
                case 'explicit-key-ind':
                    if (!it || it.sep)
                        fc.items.push({ start: [this.sourceToken] });
                    else
                        it.start.push(this.sourceToken);
                    return;
                case 'map-value-ind':
                    if (!it || it.value)
                        fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
                    else if (it.sep)
                        it.sep.push(this.sourceToken);
                    else
                        Object.assign(it, { key: null, sep: [this.sourceToken] });
                    return;
                case 'space':
                case 'comment':
                case 'newline':
                case 'anchor':
                case 'tag':
                    if (!it || it.value)
                        fc.items.push({ start: [this.sourceToken] });
                    else if (it.sep)
                        it.sep.push(this.sourceToken);
                    else
                        it.start.push(this.sourceToken);
                    return;
                case 'alias':
                case 'scalar':
                case 'single-quoted-scalar':
                case 'double-quoted-scalar': {
                    const fs = this.flowScalar(this.type);
                    if (!it || it.value)
                        fc.items.push({ start: [], key: fs, sep: [] });
                    else if (it.sep)
                        this.stack.push(fs);
                    else
                        Object.assign(it, { key: fs, sep: [] });
                    return;
                }
                case 'flow-map-end':
                case 'flow-seq-end':
                    fc.end.push(this.sourceToken);
                    return;
            }
            const bv = this.startBlockValue(fc);
            /* istanbul ignore else should not happen */
            if (bv)
                this.stack.push(bv);
            else {
                yield* this.pop();
                yield* this.step();
            }
        }
        else {
            const parent = this.peek(2);
            if (parent.type === 'block-map' &&
                ((this.type === 'map-value-ind' && parent.indent === fc.indent) ||
                    (this.type === 'newline' &&
                        !parent.items[parent.items.length - 1].sep))) {
                yield* this.pop();
                yield* this.step();
            }
            else if (this.type === 'map-value-ind' &&
                parent.type !== 'flow-collection') {
                const prev = getPrevProps(parent);
                const start = getFirstKeyStartProps(prev);
                fixFlowSeqItems(fc);
                const sep = fc.end.splice(1, fc.end.length);
                sep.push(this.sourceToken);
                const map = {
                    type: 'block-map',
                    offset: fc.offset,
                    indent: fc.indent,
                    items: [{ start, key: fc, sep }]
                };
                this.onKeyLine = true;
                this.stack[this.stack.length - 1] = map;
            }
            else {
                yield* this.lineEnd(fc);
            }
        }
    }
    flowScalar(type) {
        if (this.onNewLine) {
            let nl = this.source.indexOf('\n') + 1;
            while (nl !== 0) {
                this.onNewLine(this.offset + nl);
                nl = this.source.indexOf('\n', nl) + 1;
            }
        }
        return {
            type,
            offset: this.offset,
            indent: this.indent,
            source: this.source
        };
    }
    startBlockValue(parent) {
        switch (this.type) {
            case 'alias':
            case 'scalar':
            case 'single-quoted-scalar':
            case 'double-quoted-scalar':
                return this.flowScalar(this.type);
            case 'block-scalar-header':
                return {
                    type: 'block-scalar',
                    offset: this.offset,
                    indent: this.indent,
                    props: [this.sourceToken],
                    source: ''
                };
            case 'flow-map-start':
            case 'flow-seq-start':
                return {
                    type: 'flow-collection',
                    offset: this.offset,
                    indent: this.indent,
                    start: this.sourceToken,
                    items: [],
                    end: []
                };
            case 'seq-item-ind':
                return {
                    type: 'block-seq',
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: [this.sourceToken] }]
                };
            case 'explicit-key-ind': {
                this.onKeyLine = true;
                const prev = getPrevProps(parent);
                const start = getFirstKeyStartProps(prev);
                start.push(this.sourceToken);
                return {
                    type: 'block-map',
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start, explicitKey: true }]
                };
            }
            case 'map-value-ind': {
                this.onKeyLine = true;
                const prev = getPrevProps(parent);
                const start = getFirstKeyStartProps(prev);
                return {
                    type: 'block-map',
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start, key: null, sep: [this.sourceToken] }]
                };
            }
        }
        return null;
    }
    atIndentedComment(start, indent) {
        if (this.type !== 'comment')
            return false;
        if (this.indent <= indent)
            return false;
        return start.every(st => st.type === 'newline' || st.type === 'space');
    }
    *documentEnd(docEnd) {
        if (this.type !== 'doc-mode') {
            if (docEnd.end)
                docEnd.end.push(this.sourceToken);
            else
                docEnd.end = [this.sourceToken];
            if (this.type === 'newline')
                yield* this.pop();
        }
    }
    *lineEnd(token) {
        switch (this.type) {
            case 'comma':
            case 'doc-start':
            case 'doc-end':
            case 'flow-seq-end':
            case 'flow-map-end':
            case 'map-value-ind':
                yield* this.pop();
                yield* this.step();
                break;
            case 'newline':
                this.onKeyLine = false;
            // fallthrough
            case 'space':
            case 'comment':
            default:
                // all other values are errors
                if (token.end)
                    token.end.push(this.sourceToken);
                else
                    token.end = [this.sourceToken];
                if (this.type === 'newline')
                    yield* this.pop();
        }
    }
}

exports.Parser = Parser;


/***/ }),

/***/ 4047:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var composer = __nccwpck_require__(9984);
var Document = __nccwpck_require__(3021);
var errors = __nccwpck_require__(1464);
var log = __nccwpck_require__(7249);
var identity = __nccwpck_require__(1127);
var lineCounter = __nccwpck_require__(6628);
var parser = __nccwpck_require__(3456);

function parseOptions(options) {
    const prettyErrors = options.prettyErrors !== false;
    const lineCounter$1 = options.lineCounter || (prettyErrors && new lineCounter.LineCounter()) || null;
    return { lineCounter: lineCounter$1, prettyErrors };
}
/**
 * Parse the input as a stream of YAML documents.
 *
 * Documents should be separated from each other by `...` or `---` marker lines.
 *
 * @returns If an empty `docs` array is returned, it will be of type
 *   EmptyStream and contain additional stream information. In
 *   TypeScript, you should use `'empty' in docs` as a type guard for it.
 */
function parseAllDocuments(source, options = {}) {
    const { lineCounter, prettyErrors } = parseOptions(options);
    const parser$1 = new parser.Parser(lineCounter?.addNewLine);
    const composer$1 = new composer.Composer(options);
    const docs = Array.from(composer$1.compose(parser$1.parse(source)));
    if (prettyErrors && lineCounter)
        for (const doc of docs) {
            doc.errors.forEach(errors.prettifyError(source, lineCounter));
            doc.warnings.forEach(errors.prettifyError(source, lineCounter));
        }
    if (docs.length > 0)
        return docs;
    return Object.assign([], { empty: true }, composer$1.streamInfo());
}
/** Parse an input string into a single YAML.Document */
function parseDocument(source, options = {}) {
    const { lineCounter, prettyErrors } = parseOptions(options);
    const parser$1 = new parser.Parser(lineCounter?.addNewLine);
    const composer$1 = new composer.Composer(options);
    // `doc` is always set by compose.end(true) at the very latest
    let doc = null;
    for (const _doc of composer$1.compose(parser$1.parse(source), true, source.length)) {
        if (!doc)
            doc = _doc;
        else if (doc.options.logLevel !== 'silent') {
            doc.errors.push(new errors.YAMLParseError(_doc.range.slice(0, 2), 'MULTIPLE_DOCS', 'Source contains multiple documents; please use YAML.parseAllDocuments()'));
            break;
        }
    }
    if (prettyErrors && lineCounter) {
        doc.errors.forEach(errors.prettifyError(source, lineCounter));
        doc.warnings.forEach(errors.prettifyError(source, lineCounter));
    }
    return doc;
}
function parse(src, reviver, options) {
    let _reviver = undefined;
    if (typeof reviver === 'function') {
        _reviver = reviver;
    }
    else if (options === undefined && reviver && typeof reviver === 'object') {
        options = reviver;
    }
    const doc = parseDocument(src, options);
    if (!doc)
        return null;
    doc.warnings.forEach(warning => log.warn(doc.options.logLevel, warning));
    if (doc.errors.length > 0) {
        if (doc.options.logLevel !== 'silent')
            throw doc.errors[0];
        else
            doc.errors = [];
    }
    return doc.toJS(Object.assign({ reviver: _reviver }, options));
}
function stringify(value, replacer, options) {
    let _replacer = null;
    if (typeof replacer === 'function' || Array.isArray(replacer)) {
        _replacer = replacer;
    }
    else if (options === undefined && replacer) {
        options = replacer;
    }
    if (typeof options === 'string')
        options = options.length;
    if (typeof options === 'number') {
        const indent = Math.round(options);
        options = indent < 1 ? undefined : indent > 8 ? { indent: 8 } : { indent };
    }
    if (value === undefined) {
        const { keepUndefined } = options ?? replacer ?? {};
        if (!keepUndefined)
            return undefined;
    }
    if (identity.isDocument(value) && !_replacer)
        return value.toString(options);
    return new Document.Document(value, _replacer, options).toString(options);
}

exports.parse = parse;
exports.parseAllDocuments = parseAllDocuments;
exports.parseDocument = parseDocument;
exports.stringify = stringify;


/***/ }),

/***/ 5840:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var identity = __nccwpck_require__(1127);
var map = __nccwpck_require__(7451);
var seq = __nccwpck_require__(1706);
var string = __nccwpck_require__(6464);
var tags = __nccwpck_require__(18);

const sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
class Schema {
    constructor({ compat, customTags, merge, resolveKnownTags, schema, sortMapEntries, toStringDefaults }) {
        this.compat = Array.isArray(compat)
            ? tags.getTags(compat, 'compat')
            : compat
                ? tags.getTags(null, compat)
                : null;
        this.name = (typeof schema === 'string' && schema) || 'core';
        this.knownTags = resolveKnownTags ? tags.coreKnownTags : {};
        this.tags = tags.getTags(customTags, this.name, merge);
        this.toStringOptions = toStringDefaults ?? null;
        Object.defineProperty(this, identity.MAP, { value: map.map });
        Object.defineProperty(this, identity.SCALAR, { value: string.string });
        Object.defineProperty(this, identity.SEQ, { value: seq.seq });
        // Used by createMap()
        this.sortMapEntries =
            typeof sortMapEntries === 'function'
                ? sortMapEntries
                : sortMapEntries === true
                    ? sortMapEntriesByKey
                    : null;
    }
    clone() {
        const copy = Object.create(Schema.prototype, Object.getOwnPropertyDescriptors(this));
        copy.tags = this.tags.slice();
        return copy;
    }
}

exports.Schema = Schema;


/***/ }),

/***/ 7451:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var identity = __nccwpck_require__(1127);
var YAMLMap = __nccwpck_require__(4454);

const map = {
    collection: 'map',
    default: true,
    nodeClass: YAMLMap.YAMLMap,
    tag: 'tag:yaml.org,2002:map',
    resolve(map, onError) {
        if (!identity.isMap(map))
            onError('Expected a mapping for this tag');
        return map;
    },
    createNode: (schema, obj, ctx) => YAMLMap.YAMLMap.from(schema, obj, ctx)
};

exports.map = map;


/***/ }),

/***/ 3632:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var Scalar = __nccwpck_require__(3301);

const nullTag = {
    identify: value => value == null,
    createNode: () => new Scalar.Scalar(null),
    default: true,
    tag: 'tag:yaml.org,2002:null',
    test: /^(?:~|[Nn]ull|NULL)?$/,
    resolve: () => new Scalar.Scalar(null),
    stringify: ({ source }, ctx) => typeof source === 'string' && nullTag.test.test(source)
        ? source
        : ctx.options.nullStr
};

exports.nullTag = nullTag;


/***/ }),

/***/ 1706:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var identity = __nccwpck_require__(1127);
var YAMLSeq = __nccwpck_require__(2223);

const seq = {
    collection: 'seq',
    default: true,
    nodeClass: YAMLSeq.YAMLSeq,
    tag: 'tag:yaml.org,2002:seq',
    resolve(seq, onError) {
        if (!identity.isSeq(seq))
            onError('Expected a sequence for this tag');
        return seq;
    },
    createNode: (schema, obj, ctx) => YAMLSeq.YAMLSeq.from(schema, obj, ctx)
};

exports.seq = seq;


/***/ }),

/***/ 6464:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var stringifyString = __nccwpck_require__(3069);

const string = {
    identify: value => typeof value === 'string',
    default: true,
    tag: 'tag:yaml.org,2002:str',
    resolve: str => str,
    stringify(item, ctx, onComment, onChompKeep) {
        ctx = Object.assign({ actualString: true }, ctx);
        return stringifyString.stringifyString(item, ctx, onComment, onChompKeep);
    }
};

exports.string = string;


/***/ }),

/***/ 3959:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var Scalar = __nccwpck_require__(3301);

const boolTag = {
    identify: value => typeof value === 'boolean',
    default: true,
    tag: 'tag:yaml.org,2002:bool',
    test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
    resolve: str => new Scalar.Scalar(str[0] === 't' || str[0] === 'T'),
    stringify({ source, value }, ctx) {
        if (source && boolTag.test.test(source)) {
            const sv = source[0] === 't' || source[0] === 'T';
            if (value === sv)
                return source;
        }
        return value ? ctx.options.trueStr : ctx.options.falseStr;
    }
};

exports.boolTag = boolTag;


/***/ }),

/***/ 8405:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var Scalar = __nccwpck_require__(3301);
var stringifyNumber = __nccwpck_require__(8689);

const floatNaN = {
    identify: value => typeof value === 'number',
    default: true,
    tag: 'tag:yaml.org,2002:float',
    test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
    resolve: str => str.slice(-3).toLowerCase() === 'nan'
        ? NaN
        : str[0] === '-'
            ? Number.NEGATIVE_INFINITY
            : Number.POSITIVE_INFINITY,
    stringify: stringifyNumber.stringifyNumber
};
const floatExp = {
    identify: value => typeof value === 'number',
    default: true,
    tag: 'tag:yaml.org,2002:float',
    format: 'EXP',
    test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
    resolve: str => parseFloat(str),
    stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
    }
};
const float = {
    identify: value => typeof value === 'number',
    default: true,
    tag: 'tag:yaml.org,2002:float',
    test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
    resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str));
        const dot = str.indexOf('.');
        if (dot !== -1 && str[str.length - 1] === '0')
            node.minFractionDigits = str.length - dot - 1;
        return node;
    },
    stringify: stringifyNumber.stringifyNumber
};

exports.float = float;
exports.floatExp = floatExp;
exports.floatNaN = floatNaN;


/***/ }),

/***/ 9874:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var stringifyNumber = __nccwpck_require__(8689);

const intIdentify = (value) => typeof value === 'bigint' || Number.isInteger(value);
const intResolve = (str, offset, radix, { intAsBigInt }) => (intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix));
function intStringify(node, radix, prefix) {
    const { value } = node;
    if (intIdentify(value) && value >= 0)
        return prefix + value.toString(radix);
    return stringifyNumber.stringifyNumber(node);
}
const intOct = {
    identify: value => intIdentify(value) && value >= 0,
    default: true,
    tag: 'tag:yaml.org,2002:int',
    format: 'OCT',
    test: /^0o[0-7]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
    stringify: node => intStringify(node, 8, '0o')
};
const int = {
    identify: intIdentify,
    default: true,
    tag: 'tag:yaml.org,2002:int',
    test: /^[-+]?[0-9]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
    stringify: stringifyNumber.stringifyNumber
};
const intHex = {
    identify: value => intIdentify(value) && value >= 0,
    default: true,
    tag: 'tag:yaml.org,2002:int',
    format: 'HEX',
    test: /^0x[0-9a-fA-F]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
    stringify: node => intStringify(node, 16, '0x')
};

exports.int = int;
exports.intHex = intHex;
exports.intOct = intOct;


/***/ }),

/***/ 896:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var map = __nccwpck_require__(7451);
var _null = __nccwpck_require__(3632);
var seq = __nccwpck_require__(1706);
var string = __nccwpck_require__(6464);
var bool = __nccwpck_require__(3959);
var float = __nccwpck_require__(8405);
var int = __nccwpck_require__(9874);

const schema = [
    map.map,
    seq.seq,
    string.string,
    _null.nullTag,
    bool.boolTag,
    int.intOct,
    int.int,
    int.intHex,
    float.floatNaN,
    float.floatExp,
    float.float
];

exports.schema = schema;


/***/ }),

/***/ 3559:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var Scalar = __nccwpck_require__(3301);
var map = __nccwpck_require__(7451);
var seq = __nccwpck_require__(1706);

function intIdentify(value) {
    return typeof value === 'bigint' || Number.isInteger(value);
}
const stringifyJSON = ({ value }) => JSON.stringify(value);
const jsonScalars = [
    {
        identify: value => typeof value === 'string',
        default: true,
        tag: 'tag:yaml.org,2002:str',
        resolve: str => str,
        stringify: stringifyJSON
    },
    {
        identify: value => value == null,
        createNode: () => new Scalar.Scalar(null),
        default: true,
        tag: 'tag:yaml.org,2002:null',
        test: /^null$/,
        resolve: () => null,
        stringify: stringifyJSON
    },
    {
        identify: value => typeof value === 'boolean',
        default: true,
        tag: 'tag:yaml.org,2002:bool',
        test: /^true$|^false$/,
        resolve: str => str === 'true',
        stringify: stringifyJSON
    },
    {
        identify: intIdentify,
        default: true,
        tag: 'tag:yaml.org,2002:int',
        test: /^-?(?:0|[1-9][0-9]*)$/,
        resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
        stringify: ({ value }) => intIdentify(value) ? value.toString() : JSON.stringify(value)
    },
    {
        identify: value => typeof value === 'number',
        default: true,
        tag: 'tag:yaml.org,2002:float',
        test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
        resolve: str => parseFloat(str),
        stringify: stringifyJSON
    }
];
const jsonError = {
    default: true,
    tag: '',
    test: /^/,
    resolve(str, onError) {
        onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
        return str;
    }
};
const schema = [map.map, seq.seq].concat(jsonScalars, jsonError);

exports.schema = schema;


/***/ }),

/***/ 18:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var map = __nccwpck_require__(7451);
var _null = __nccwpck_require__(3632);
var seq = __nccwpck_require__(1706);
var string = __nccwpck_require__(6464);
var bool = __nccwpck_require__(3959);
var float = __nccwpck_require__(8405);
var int = __nccwpck_require__(9874);
var schema = __nccwpck_require__(896);
var schema$1 = __nccwpck_require__(3559);
var binary = __nccwpck_require__(6083);
var merge = __nccwpck_require__(452);
var omap = __nccwpck_require__(303);
var pairs = __nccwpck_require__(8385);
var schema$2 = __nccwpck_require__(5913);
var set = __nccwpck_require__(1528);
var timestamp = __nccwpck_require__(6752);

const schemas = new Map([
    ['core', schema.schema],
    ['failsafe', [map.map, seq.seq, string.string]],
    ['json', schema$1.schema],
    ['yaml11', schema$2.schema],
    ['yaml-1.1', schema$2.schema]
]);
const tagsByName = {
    binary: binary.binary,
    bool: bool.boolTag,
    float: float.float,
    floatExp: float.floatExp,
    floatNaN: float.floatNaN,
    floatTime: timestamp.floatTime,
    int: int.int,
    intHex: int.intHex,
    intOct: int.intOct,
    intTime: timestamp.intTime,
    map: map.map,
    merge: merge.merge,
    null: _null.nullTag,
    omap: omap.omap,
    pairs: pairs.pairs,
    seq: seq.seq,
    set: set.set,
    timestamp: timestamp.timestamp
};
const coreKnownTags = {
    'tag:yaml.org,2002:binary': binary.binary,
    'tag:yaml.org,2002:merge': merge.merge,
    'tag:yaml.org,2002:omap': omap.omap,
    'tag:yaml.org,2002:pairs': pairs.pairs,
    'tag:yaml.org,2002:set': set.set,
    'tag:yaml.org,2002:timestamp': timestamp.timestamp
};
function getTags(customTags, schemaName, addMergeTag) {
    const schemaTags = schemas.get(schemaName);
    if (schemaTags && !customTags) {
        return addMergeTag && !schemaTags.includes(merge.merge)
            ? schemaTags.concat(merge.merge)
            : schemaTags.slice();
    }
    let tags = schemaTags;
    if (!tags) {
        if (Array.isArray(customTags))
            tags = [];
        else {
            const keys = Array.from(schemas.keys())
                .filter(key => key !== 'yaml11')
                .map(key => JSON.stringify(key))
                .join(', ');
            throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
        }
    }
    if (Array.isArray(customTags)) {
        for (const tag of customTags)
            tags = tags.concat(tag);
    }
    else if (typeof customTags === 'function') {
        tags = customTags(tags.slice());
    }
    if (addMergeTag)
        tags = tags.concat(merge.merge);
    return tags.reduce((tags, tag) => {
        const tagObj = typeof tag === 'string' ? tagsByName[tag] : tag;
        if (!tagObj) {
            const tagName = JSON.stringify(tag);
            const keys = Object.keys(tagsByName)
                .map(key => JSON.stringify(key))
                .join(', ');
            throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
        }
        if (!tags.includes(tagObj))
            tags.push(tagObj);
        return tags;
    }, []);
}

exports.coreKnownTags = coreKnownTags;
exports.getTags = getTags;


/***/ }),

/***/ 6083:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var node_buffer = __nccwpck_require__(181);
var Scalar = __nccwpck_require__(3301);
var stringifyString = __nccwpck_require__(3069);

const binary = {
    identify: value => value instanceof Uint8Array, // Buffer inherits from Uint8Array
    default: false,
    tag: 'tag:yaml.org,2002:binary',
    /**
     * Returns a Buffer in node and an Uint8Array in browsers
     *
     * To use the resulting buffer as an image, you'll want to do something like:
     *
     *   const blob = new Blob([buffer], { type: 'image/jpeg' })
     *   document.querySelector('#photo').src = URL.createObjectURL(blob)
     */
    resolve(src, onError) {
        if (typeof node_buffer.Buffer === 'function') {
            return node_buffer.Buffer.from(src, 'base64');
        }
        else if (typeof atob === 'function') {
            // On IE 11, atob() can't handle newlines
            const str = atob(src.replace(/[\n\r]/g, ''));
            const buffer = new Uint8Array(str.length);
            for (let i = 0; i < str.length; ++i)
                buffer[i] = str.charCodeAt(i);
            return buffer;
        }
        else {
            onError('This environment does not support reading binary tags; either Buffer or atob is required');
            return src;
        }
    },
    stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
        if (!value)
            return '';
        const buf = value; // checked earlier by binary.identify()
        let str;
        if (typeof node_buffer.Buffer === 'function') {
            str =
                buf instanceof node_buffer.Buffer
                    ? buf.toString('base64')
                    : node_buffer.Buffer.from(buf.buffer).toString('base64');
        }
        else if (typeof btoa === 'function') {
            let s = '';
            for (let i = 0; i < buf.length; ++i)
                s += String.fromCharCode(buf[i]);
            str = btoa(s);
        }
        else {
            throw new Error('This environment does not support writing binary tags; either Buffer or btoa is required');
        }
        type ?? (type = Scalar.Scalar.BLOCK_LITERAL);
        if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
            const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
            const n = Math.ceil(str.length / lineWidth);
            const lines = new Array(n);
            for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
                lines[i] = str.substr(o, lineWidth);
            }
            str = lines.join(type === Scalar.Scalar.BLOCK_LITERAL ? '\n' : ' ');
        }
        return stringifyString.stringifyString({ comment, type, value: str }, ctx, onComment, onChompKeep);
    }
};

exports.binary = binary;


/***/ }),

/***/ 8398:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var Scalar = __nccwpck_require__(3301);

function boolStringify({ value, source }, ctx) {
    const boolObj = value ? trueTag : falseTag;
    if (source && boolObj.test.test(source))
        return source;
    return value ? ctx.options.trueStr : ctx.options.falseStr;
}
const trueTag = {
    identify: value => value === true,
    default: true,
    tag: 'tag:yaml.org,2002:bool',
    test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
    resolve: () => new Scalar.Scalar(true),
    stringify: boolStringify
};
const falseTag = {
    identify: value => value === false,
    default: true,
    tag: 'tag:yaml.org,2002:bool',
    test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
    resolve: () => new Scalar.Scalar(false),
    stringify: boolStringify
};

exports.falseTag = falseTag;
exports.trueTag = trueTag;


/***/ }),

/***/ 5782:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var Scalar = __nccwpck_require__(3301);
var stringifyNumber = __nccwpck_require__(8689);

const floatNaN = {
    identify: value => typeof value === 'number',
    default: true,
    tag: 'tag:yaml.org,2002:float',
    test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
    resolve: (str) => str.slice(-3).toLowerCase() === 'nan'
        ? NaN
        : str[0] === '-'
            ? Number.NEGATIVE_INFINITY
            : Number.POSITIVE_INFINITY,
    stringify: stringifyNumber.stringifyNumber
};
const floatExp = {
    identify: value => typeof value === 'number',
    default: true,
    tag: 'tag:yaml.org,2002:float',
    format: 'EXP',
    test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
    resolve: (str) => parseFloat(str.replace(/_/g, '')),
    stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
    }
};
const float = {
    identify: value => typeof value === 'number',
    default: true,
    tag: 'tag:yaml.org,2002:float',
    test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
    resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str.replace(/_/g, '')));
        const dot = str.indexOf('.');
        if (dot !== -1) {
            const f = str.substring(dot + 1).replace(/_/g, '');
            if (f[f.length - 1] === '0')
                node.minFractionDigits = f.length;
        }
        return node;
    },
    stringify: stringifyNumber.stringifyNumber
};

exports.float = float;
exports.floatExp = floatExp;
exports.floatNaN = floatNaN;


/***/ }),

/***/ 873:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var stringifyNumber = __nccwpck_require__(8689);

const intIdentify = (value) => typeof value === 'bigint' || Number.isInteger(value);
function intResolve(str, offset, radix, { intAsBigInt }) {
    const sign = str[0];
    if (sign === '-' || sign === '+')
        offset += 1;
    str = str.substring(offset).replace(/_/g, '');
    if (intAsBigInt) {
        switch (radix) {
            case 2:
                str = `0b${str}`;
                break;
            case 8:
                str = `0o${str}`;
                break;
            case 16:
                str = `0x${str}`;
                break;
        }
        const n = BigInt(str);
        return sign === '-' ? BigInt(-1) * n : n;
    }
    const n = parseInt(str, radix);
    return sign === '-' ? -1 * n : n;
}
function intStringify(node, radix, prefix) {
    const { value } = node;
    if (intIdentify(value)) {
        const str = value.toString(radix);
        return value < 0 ? '-' + prefix + str.substr(1) : prefix + str;
    }
    return stringifyNumber.stringifyNumber(node);
}
const intBin = {
    identify: intIdentify,
    default: true,
    tag: 'tag:yaml.org,2002:int',
    format: 'BIN',
    test: /^[-+]?0b[0-1_]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 2, 2, opt),
    stringify: node => intStringify(node, 2, '0b')
};
const intOct = {
    identify: intIdentify,
    default: true,
    tag: 'tag:yaml.org,2002:int',
    format: 'OCT',
    test: /^[-+]?0[0-7_]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 1, 8, opt),
    stringify: node => intStringify(node, 8, '0')
};
const int = {
    identify: intIdentify,
    default: true,
    tag: 'tag:yaml.org,2002:int',
    test: /^[-+]?[0-9][0-9_]*$/,
    resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
    stringify: stringifyNumber.stringifyNumber
};
const intHex = {
    identify: intIdentify,
    default: true,
    tag: 'tag:yaml.org,2002:int',
    format: 'HEX',
    test: /^[-+]?0x[0-9a-fA-F_]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
    stringify: node => intStringify(node, 16, '0x')
};

exports.int = int;
exports.intBin = intBin;
exports.intHex = intHex;
exports.intOct = intOct;


/***/ }),

/***/ 452:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var identity = __nccwpck_require__(1127);
var Scalar = __nccwpck_require__(3301);

// If the value associated with a merge key is a single mapping node, each of
// its key/value pairs is inserted into the current mapping, unless the key
// already exists in it. If the value associated with the merge key is a
// sequence, then this sequence is expected to contain mapping nodes and each
// of these nodes is merged in turn according to its order in the sequence.
// Keys in mapping nodes earlier in the sequence override keys specified in
// later mapping nodes. -- http://yaml.org/type/merge.html
const MERGE_KEY = '<<';
const merge = {
    identify: value => value === MERGE_KEY ||
        (typeof value === 'symbol' && value.description === MERGE_KEY),
    default: 'key',
    tag: 'tag:yaml.org,2002:merge',
    test: /^<<$/,
    resolve: () => Object.assign(new Scalar.Scalar(Symbol(MERGE_KEY)), {
        addToJSMap: addMergeToJSMap
    }),
    stringify: () => MERGE_KEY
};
const isMergeKey = (ctx, key) => (merge.identify(key) ||
    (identity.isScalar(key) &&
        (!key.type || key.type === Scalar.Scalar.PLAIN) &&
        merge.identify(key.value))) &&
    ctx?.doc.schema.tags.some(tag => tag.tag === merge.tag && tag.default);
function addMergeToJSMap(ctx, map, value) {
    const source = resolveAliasValue(ctx, value);
    if (identity.isSeq(source))
        for (const it of source.items)
            mergeValue(ctx, map, it);
    else if (Array.isArray(source))
        for (const it of source)
            mergeValue(ctx, map, it);
    else
        mergeValue(ctx, map, source);
}
function mergeValue(ctx, map, value) {
    const source = resolveAliasValue(ctx, value);
    if (!identity.isMap(source))
        throw new Error('Merge sources must be maps or map aliases');
    const srcMap = source.toJSON(null, ctx, Map);
    for (const [key, value] of srcMap) {
        if (map instanceof Map) {
            if (!map.has(key))
                map.set(key, value);
        }
        else if (map instanceof Set) {
            map.add(key);
        }
        else if (!Object.prototype.hasOwnProperty.call(map, key)) {
            Object.defineProperty(map, key, {
                value,
                writable: true,
                enumerable: true,
                configurable: true
            });
        }
    }
    return map;
}
function resolveAliasValue(ctx, value) {
    return ctx && identity.isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
}

exports.addMergeToJSMap = addMergeToJSMap;
exports.isMergeKey = isMergeKey;
exports.merge = merge;


/***/ }),

/***/ 303:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var identity = __nccwpck_require__(1127);
var toJS = __nccwpck_require__(4043);
var YAMLMap = __nccwpck_require__(4454);
var YAMLSeq = __nccwpck_require__(2223);
var pairs = __nccwpck_require__(8385);

class YAMLOMap extends YAMLSeq.YAMLSeq {
    constructor() {
        super();
        this.add = YAMLMap.YAMLMap.prototype.add.bind(this);
        this.delete = YAMLMap.YAMLMap.prototype.delete.bind(this);
        this.get = YAMLMap.YAMLMap.prototype.get.bind(this);
        this.has = YAMLMap.YAMLMap.prototype.has.bind(this);
        this.set = YAMLMap.YAMLMap.prototype.set.bind(this);
        this.tag = YAMLOMap.tag;
    }
    /**
     * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
     * but TypeScript won't allow widening the signature of a child method.
     */
    toJSON(_, ctx) {
        if (!ctx)
            return super.toJSON(_);
        const map = new Map();
        if (ctx?.onCreate)
            ctx.onCreate(map);
        for (const pair of this.items) {
            let key, value;
            if (identity.isPair(pair)) {
                key = toJS.toJS(pair.key, '', ctx);
                value = toJS.toJS(pair.value, key, ctx);
            }
            else {
                key = toJS.toJS(pair, '', ctx);
            }
            if (map.has(key))
                throw new Error('Ordered maps must not include duplicate keys');
            map.set(key, value);
        }
        return map;
    }
    static from(schema, iterable, ctx) {
        const pairs$1 = pairs.createPairs(schema, iterable, ctx);
        const omap = new this();
        omap.items = pairs$1.items;
        return omap;
    }
}
YAMLOMap.tag = 'tag:yaml.org,2002:omap';
const omap = {
    collection: 'seq',
    identify: value => value instanceof Map,
    nodeClass: YAMLOMap,
    default: false,
    tag: 'tag:yaml.org,2002:omap',
    resolve(seq, onError) {
        const pairs$1 = pairs.resolvePairs(seq, onError);
        const seenKeys = [];
        for (const { key } of pairs$1.items) {
            if (identity.isScalar(key)) {
                if (seenKeys.includes(key.value)) {
                    onError(`Ordered maps must not include duplicate keys: ${key.value}`);
                }
                else {
                    seenKeys.push(key.value);
                }
            }
        }
        return Object.assign(new YAMLOMap(), pairs$1);
    },
    createNode: (schema, iterable, ctx) => YAMLOMap.from(schema, iterable, ctx)
};

exports.YAMLOMap = YAMLOMap;
exports.omap = omap;


/***/ }),

/***/ 8385:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var identity = __nccwpck_require__(1127);
var Pair = __nccwpck_require__(7165);
var Scalar = __nccwpck_require__(3301);
var YAMLSeq = __nccwpck_require__(2223);

function resolvePairs(seq, onError) {
    if (identity.isSeq(seq)) {
        for (let i = 0; i < seq.items.length; ++i) {
            let item = seq.items[i];
            if (identity.isPair(item))
                continue;
            else if (identity.isMap(item)) {
                if (item.items.length > 1)
                    onError('Each pair must have its own sequence indicator');
                const pair = item.items[0] || new Pair.Pair(new Scalar.Scalar(null));
                if (item.commentBefore)
                    pair.key.commentBefore = pair.key.commentBefore
                        ? `${item.commentBefore}\n${pair.key.commentBefore}`
                        : item.commentBefore;
                if (item.comment) {
                    const cn = pair.value ?? pair.key;
                    cn.comment = cn.comment
                        ? `${item.comment}\n${cn.comment}`
                        : item.comment;
                }
                item = pair;
            }
            seq.items[i] = identity.isPair(item) ? item : new Pair.Pair(item);
        }
    }
    else
        onError('Expected a sequence for this tag');
    return seq;
}
function createPairs(schema, iterable, ctx) {
    const { replacer } = ctx;
    const pairs = new YAMLSeq.YAMLSeq(schema);
    pairs.tag = 'tag:yaml.org,2002:pairs';
    let i = 0;
    if (iterable && Symbol.iterator in Object(iterable))
        for (let it of iterable) {
            if (typeof replacer === 'function')
                it = replacer.call(iterable, String(i++), it);
            let key, value;
            if (Array.isArray(it)) {
                if (it.length === 2) {
                    key = it[0];
                    value = it[1];
                }
                else
                    throw new TypeError(`Expected [key, value] tuple: ${it}`);
            }
            else if (it && it instanceof Object) {
                const keys = Object.keys(it);
                if (keys.length === 1) {
                    key = keys[0];
                    value = it[key];
                }
                else {
                    throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
                }
            }
            else {
                key = it;
            }
            pairs.items.push(Pair.createPair(key, value, ctx));
        }
    return pairs;
}
const pairs = {
    collection: 'seq',
    default: false,
    tag: 'tag:yaml.org,2002:pairs',
    resolve: resolvePairs,
    createNode: createPairs
};

exports.createPairs = createPairs;
exports.pairs = pairs;
exports.resolvePairs = resolvePairs;


/***/ }),

/***/ 5913:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var map = __nccwpck_require__(7451);
var _null = __nccwpck_require__(3632);
var seq = __nccwpck_require__(1706);
var string = __nccwpck_require__(6464);
var binary = __nccwpck_require__(6083);
var bool = __nccwpck_require__(8398);
var float = __nccwpck_require__(5782);
var int = __nccwpck_require__(873);
var merge = __nccwpck_require__(452);
var omap = __nccwpck_require__(303);
var pairs = __nccwpck_require__(8385);
var set = __nccwpck_require__(1528);
var timestamp = __nccwpck_require__(6752);

const schema = [
    map.map,
    seq.seq,
    string.string,
    _null.nullTag,
    bool.trueTag,
    bool.falseTag,
    int.intBin,
    int.intOct,
    int.int,
    int.intHex,
    float.floatNaN,
    float.floatExp,
    float.float,
    binary.binary,
    merge.merge,
    omap.omap,
    pairs.pairs,
    set.set,
    timestamp.intTime,
    timestamp.floatTime,
    timestamp.timestamp
];

exports.schema = schema;


/***/ }),

/***/ 1528:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var identity = __nccwpck_require__(1127);
var Pair = __nccwpck_require__(7165);
var YAMLMap = __nccwpck_require__(4454);

class YAMLSet extends YAMLMap.YAMLMap {
    constructor(schema) {
        super(schema);
        this.tag = YAMLSet.tag;
    }
    add(key) {
        let pair;
        if (identity.isPair(key))
            pair = key;
        else if (key &&
            typeof key === 'object' &&
            'key' in key &&
            'value' in key &&
            key.value === null)
            pair = new Pair.Pair(key.key, null);
        else
            pair = new Pair.Pair(key, null);
        const prev = YAMLMap.findPair(this.items, pair.key);
        if (!prev)
            this.items.push(pair);
    }
    /**
     * If `keepPair` is `true`, returns the Pair matching `key`.
     * Otherwise, returns the value of that Pair's key.
     */
    get(key, keepPair) {
        const pair = YAMLMap.findPair(this.items, key);
        return !keepPair && identity.isPair(pair)
            ? identity.isScalar(pair.key)
                ? pair.key.value
                : pair.key
            : pair;
    }
    set(key, value) {
        if (typeof value !== 'boolean')
            throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
        const prev = YAMLMap.findPair(this.items, key);
        if (prev && !value) {
            this.items.splice(this.items.indexOf(prev), 1);
        }
        else if (!prev && value) {
            this.items.push(new Pair.Pair(key));
        }
    }
    toJSON(_, ctx) {
        return super.toJSON(_, ctx, Set);
    }
    toString(ctx, onComment, onChompKeep) {
        if (!ctx)
            return JSON.stringify(this);
        if (this.hasAllNullValues(true))
            return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
        else
            throw new Error('Set items must all have null values');
    }
    static from(schema, iterable, ctx) {
        const { replacer } = ctx;
        const set = new this(schema);
        if (iterable && Symbol.iterator in Object(iterable))
            for (let value of iterable) {
                if (typeof replacer === 'function')
                    value = replacer.call(iterable, value, value);
                set.items.push(Pair.createPair(value, null, ctx));
            }
        return set;
    }
}
YAMLSet.tag = 'tag:yaml.org,2002:set';
const set = {
    collection: 'map',
    identify: value => value instanceof Set,
    nodeClass: YAMLSet,
    default: false,
    tag: 'tag:yaml.org,2002:set',
    createNode: (schema, iterable, ctx) => YAMLSet.from(schema, iterable, ctx),
    resolve(map, onError) {
        if (identity.isMap(map)) {
            if (map.hasAllNullValues(true))
                return Object.assign(new YAMLSet(), map);
            else
                onError('Set items must all have null values');
        }
        else
            onError('Expected a mapping for this tag');
        return map;
    }
};

exports.YAMLSet = YAMLSet;
exports.set = set;


/***/ }),

/***/ 6752:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var stringifyNumber = __nccwpck_require__(8689);

/** Internal types handle bigint as number, because TS can't figure it out. */
function parseSexagesimal(str, asBigInt) {
    const sign = str[0];
    const parts = sign === '-' || sign === '+' ? str.substring(1) : str;
    const num = (n) => asBigInt ? BigInt(n) : Number(n);
    const res = parts
        .replace(/_/g, '')
        .split(':')
        .reduce((res, p) => res * num(60) + num(p), num(0));
    return (sign === '-' ? num(-1) * res : res);
}
/**
 * hhhh:mm:ss.sss
 *
 * Internal types handle bigint as number, because TS can't figure it out.
 */
function stringifySexagesimal(node) {
    let { value } = node;
    let num = (n) => n;
    if (typeof value === 'bigint')
        num = n => BigInt(n);
    else if (isNaN(value) || !isFinite(value))
        return stringifyNumber.stringifyNumber(node);
    let sign = '';
    if (value < 0) {
        sign = '-';
        value *= num(-1);
    }
    const _60 = num(60);
    const parts = [value % _60]; // seconds, including ms
    if (value < 60) {
        parts.unshift(0); // at least one : is required
    }
    else {
        value = (value - parts[0]) / _60;
        parts.unshift(value % _60); // minutes
        if (value >= 60) {
            value = (value - parts[0]) / _60;
            parts.unshift(value); // hours
        }
    }
    return (sign +
        parts
            .map(n => String(n).padStart(2, '0'))
            .join(':')
            .replace(/000000\d*$/, '') // % 60 may introduce error
    );
}
const intTime = {
    identify: value => typeof value === 'bigint' || Number.isInteger(value),
    default: true,
    tag: 'tag:yaml.org,2002:int',
    format: 'TIME',
    test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
    resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
    stringify: stringifySexagesimal
};
const floatTime = {
    identify: value => typeof value === 'number',
    default: true,
    tag: 'tag:yaml.org,2002:float',
    format: 'TIME',
    test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
    resolve: str => parseSexagesimal(str, false),
    stringify: stringifySexagesimal
};
const timestamp = {
    identify: value => value instanceof Date,
    default: true,
    tag: 'tag:yaml.org,2002:timestamp',
    // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
    // may be omitted altogether, resulting in a date format. In such a case, the time part is
    // assumed to be 00:00:00Z (start of day, UTC).
    test: RegExp('^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})' + // YYYY-Mm-Dd
        '(?:' + // time is optional
        '(?:t|T|[ \\t]+)' + // t | T | whitespace
        '([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)' + // Hh:Mm:Ss(.ss)?
        '(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?' + // Z | +5 | -03:30
        ')?$'),
    resolve(str) {
        const match = str.match(timestamp.test);
        if (!match)
            throw new Error('!!timestamp expects a date, starting with yyyy-mm-dd');
        const [, year, month, day, hour, minute, second] = match.map(Number);
        const millisec = match[7] ? Number((match[7] + '00').substr(1, 3)) : 0;
        let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
        const tz = match[8];
        if (tz && tz !== 'Z') {
            let d = parseSexagesimal(tz, false);
            if (Math.abs(d) < 30)
                d *= 60;
            date -= 60000 * d;
        }
        return new Date(date);
    },
    stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, '') ?? ''
};

exports.floatTime = floatTime;
exports.intTime = intTime;
exports.timestamp = timestamp;


/***/ }),

/***/ 4475:
/***/ ((__unused_webpack_module, exports) => {



const FOLD_FLOW = 'flow';
const FOLD_BLOCK = 'block';
const FOLD_QUOTED = 'quoted';
/**
 * Tries to keep input at up to `lineWidth` characters, splitting only on spaces
 * not followed by newlines or spaces unless `mode` is `'quoted'`. Lines are
 * terminated with `\n` and started with `indent`.
 */
function foldFlowLines(text, indent, mode = 'flow', { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
    if (!lineWidth || lineWidth < 0)
        return text;
    if (lineWidth < minContentWidth)
        minContentWidth = 0;
    const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
    if (text.length <= endStep)
        return text;
    const folds = [];
    const escapedFolds = {};
    let end = lineWidth - indent.length;
    if (typeof indentAtStart === 'number') {
        if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
            folds.push(0);
        else
            end = lineWidth - indentAtStart;
    }
    let split = undefined;
    let prev = undefined;
    let overflow = false;
    let i = -1;
    let escStart = -1;
    let escEnd = -1;
    if (mode === FOLD_BLOCK) {
        i = consumeMoreIndentedLines(text, i, indent.length);
        if (i !== -1)
            end = i + endStep;
    }
    for (let ch; (ch = text[(i += 1)]);) {
        if (mode === FOLD_QUOTED && ch === '\\') {
            escStart = i;
            switch (text[i + 1]) {
                case 'x':
                    i += 3;
                    break;
                case 'u':
                    i += 5;
                    break;
                case 'U':
                    i += 9;
                    break;
                default:
                    i += 1;
            }
            escEnd = i;
        }
        if (ch === '\n') {
            if (mode === FOLD_BLOCK)
                i = consumeMoreIndentedLines(text, i, indent.length);
            end = i + indent.length + endStep;
            split = undefined;
        }
        else {
            if (ch === ' ' &&
                prev &&
                prev !== ' ' &&
                prev !== '\n' &&
                prev !== '\t') {
                // space surrounded by non-space can be replaced with newline + indent
                const next = text[i + 1];
                if (next && next !== ' ' && next !== '\n' && next !== '\t')
                    split = i;
            }
            if (i >= end) {
                if (split) {
                    folds.push(split);
                    end = split + endStep;
                    split = undefined;
                }
                else if (mode === FOLD_QUOTED) {
                    // white-space collected at end may stretch past lineWidth
                    while (prev === ' ' || prev === '\t') {
                        prev = ch;
                        ch = text[(i += 1)];
                        overflow = true;
                    }
                    // Account for newline escape, but don't break preceding escape
                    const j = i > escEnd + 1 ? i - 2 : escStart - 1;
                    // Bail out if lineWidth & minContentWidth are shorter than an escape string
                    if (escapedFolds[j])
                        return text;
                    folds.push(j);
                    escapedFolds[j] = true;
                    end = j + endStep;
                    split = undefined;
                }
                else {
                    overflow = true;
                }
            }
        }
        prev = ch;
    }
    if (overflow && onOverflow)
        onOverflow();
    if (folds.length === 0)
        return text;
    if (onFold)
        onFold();
    let res = text.slice(0, folds[0]);
    for (let i = 0; i < folds.length; ++i) {
        const fold = folds[i];
        const end = folds[i + 1] || text.length;
        if (fold === 0)
            res = `\n${indent}${text.slice(0, end)}`;
        else {
            if (mode === FOLD_QUOTED && escapedFolds[fold])
                res += `${text[fold]}\\`;
            res += `\n${indent}${text.slice(fold + 1, end)}`;
        }
    }
    return res;
}
/**
 * Presumes `i + 1` is at the start of a line
 * @returns index of last newline in more-indented block
 */
function consumeMoreIndentedLines(text, i, indent) {
    let end = i;
    let start = i + 1;
    let ch = text[start];
    while (ch === ' ' || ch === '\t') {
        if (i < start + indent) {
            ch = text[++i];
        }
        else {
            do {
                ch = text[++i];
            } while (ch && ch !== '\n');
            end = i;
            start = i + 1;
            ch = text[start];
        }
    }
    return end;
}

exports.FOLD_BLOCK = FOLD_BLOCK;
exports.FOLD_FLOW = FOLD_FLOW;
exports.FOLD_QUOTED = FOLD_QUOTED;
exports.foldFlowLines = foldFlowLines;


/***/ }),

/***/ 2148:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var anchors = __nccwpck_require__(1596);
var identity = __nccwpck_require__(1127);
var stringifyComment = __nccwpck_require__(9799);
var stringifyString = __nccwpck_require__(3069);

function createStringifyContext(doc, options) {
    const opt = Object.assign({
        blockQuote: true,
        commentString: stringifyComment.stringifyComment,
        defaultKeyType: null,
        defaultStringType: 'PLAIN',
        directives: null,
        doubleQuotedAsJSON: false,
        doubleQuotedMinMultiLineLength: 40,
        falseStr: 'false',
        flowCollectionPadding: true,
        indentSeq: true,
        lineWidth: 80,
        minContentWidth: 20,
        nullStr: 'null',
        simpleKeys: false,
        singleQuote: null,
        trailingComma: false,
        trueStr: 'true',
        verifyAliasOrder: true
    }, doc.schema.toStringOptions, options);
    let inFlow;
    switch (opt.collectionStyle) {
        case 'block':
            inFlow = false;
            break;
        case 'flow':
            inFlow = true;
            break;
        default:
            inFlow = null;
    }
    return {
        anchors: new Set(),
        doc,
        flowCollectionPadding: opt.flowCollectionPadding ? ' ' : '',
        indent: '',
        indentStep: typeof opt.indent === 'number' ? ' '.repeat(opt.indent) : '  ',
        inFlow,
        options: opt
    };
}
function getTagObject(tags, item) {
    if (item.tag) {
        const match = tags.filter(t => t.tag === item.tag);
        if (match.length > 0)
            return match.find(t => t.format === item.format) ?? match[0];
    }
    let tagObj = undefined;
    let obj;
    if (identity.isScalar(item)) {
        obj = item.value;
        let match = tags.filter(t => t.identify?.(obj));
        if (match.length > 1) {
            const testMatch = match.filter(t => t.test);
            if (testMatch.length > 0)
                match = testMatch;
        }
        tagObj =
            match.find(t => t.format === item.format) ?? match.find(t => !t.format);
    }
    else {
        obj = item;
        tagObj = tags.find(t => t.nodeClass && obj instanceof t.nodeClass);
    }
    if (!tagObj) {
        const name = obj?.constructor?.name ?? (obj === null ? 'null' : typeof obj);
        throw new Error(`Tag not resolved for ${name} value`);
    }
    return tagObj;
}
// needs to be called before value stringifier to allow for circular anchor refs
function stringifyProps(node, tagObj, { anchors: anchors$1, doc }) {
    if (!doc.directives)
        return '';
    const props = [];
    const anchor = (identity.isScalar(node) || identity.isCollection(node)) && node.anchor;
    if (anchor && anchors.anchorIsValid(anchor)) {
        anchors$1.add(anchor);
        props.push(`&${anchor}`);
    }
    const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
    if (tag)
        props.push(doc.directives.tagString(tag));
    return props.join(' ');
}
function stringify(item, ctx, onComment, onChompKeep) {
    if (identity.isPair(item))
        return item.toString(ctx, onComment, onChompKeep);
    if (identity.isAlias(item)) {
        if (ctx.doc.directives)
            return item.toString(ctx);
        if (ctx.resolvedAliases?.has(item)) {
            throw new TypeError(`Cannot stringify circular structure without alias nodes`);
        }
        else {
            if (ctx.resolvedAliases)
                ctx.resolvedAliases.add(item);
            else
                ctx.resolvedAliases = new Set([item]);
            item = item.resolve(ctx.doc);
        }
    }
    let tagObj = undefined;
    const node = identity.isNode(item)
        ? item
        : ctx.doc.createNode(item, { onTagObj: o => (tagObj = o) });
    tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
    const props = stringifyProps(node, tagObj, ctx);
    if (props.length > 0)
        ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
    const str = typeof tagObj.stringify === 'function'
        ? tagObj.stringify(node, ctx, onComment, onChompKeep)
        : identity.isScalar(node)
            ? stringifyString.stringifyString(node, ctx, onComment, onChompKeep)
            : node.toString(ctx, onComment, onChompKeep);
    if (!props)
        return str;
    return identity.isScalar(node) || str[0] === '{' || str[0] === '['
        ? `${props} ${str}`
        : `${props}\n${ctx.indent}${str}`;
}

exports.createStringifyContext = createStringifyContext;
exports.stringify = stringify;


/***/ }),

/***/ 1212:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var identity = __nccwpck_require__(1127);
var stringify = __nccwpck_require__(2148);
var stringifyComment = __nccwpck_require__(9799);

function stringifyCollection(collection, ctx, options) {
    const flow = ctx.inFlow ?? collection.flow;
    const stringify = flow ? stringifyFlowCollection : stringifyBlockCollection;
    return stringify(collection, ctx, options);
}
function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
    const { indent, options: { commentString } } = ctx;
    const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
    let chompKeep = false; // flag for the preceding node's status
    const lines = [];
    for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment = null;
        if (identity.isNode(item)) {
            if (!chompKeep && item.spaceBefore)
                lines.push('');
            addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
            if (item.comment)
                comment = item.comment;
        }
        else if (identity.isPair(item)) {
            const ik = identity.isNode(item.key) ? item.key : null;
            if (ik) {
                if (!chompKeep && ik.spaceBefore)
                    lines.push('');
                addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
            }
        }
        chompKeep = false;
        let str = stringify.stringify(item, itemCtx, () => (comment = null), () => (chompKeep = true));
        if (comment)
            str += stringifyComment.lineComment(str, itemIndent, commentString(comment));
        if (chompKeep && comment)
            chompKeep = false;
        lines.push(blockItemPrefix + str);
    }
    let str;
    if (lines.length === 0) {
        str = flowChars.start + flowChars.end;
    }
    else {
        str = lines[0];
        for (let i = 1; i < lines.length; ++i) {
            const line = lines[i];
            str += line ? `\n${indent}${line}` : '\n';
        }
    }
    if (comment) {
        str += '\n' + stringifyComment.indentComment(commentString(comment), indent);
        if (onComment)
            onComment();
    }
    else if (chompKeep && onChompKeep)
        onChompKeep();
    return str;
}
function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
    const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
    itemIndent += indentStep;
    const itemCtx = Object.assign({}, ctx, {
        indent: itemIndent,
        inFlow: true,
        type: null
    });
    let reqNewline = false;
    let linesAtValue = 0;
    const lines = [];
    for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment = null;
        if (identity.isNode(item)) {
            if (item.spaceBefore)
                lines.push('');
            addCommentBefore(ctx, lines, item.commentBefore, false);
            if (item.comment)
                comment = item.comment;
        }
        else if (identity.isPair(item)) {
            const ik = identity.isNode(item.key) ? item.key : null;
            if (ik) {
                if (ik.spaceBefore)
                    lines.push('');
                addCommentBefore(ctx, lines, ik.commentBefore, false);
                if (ik.comment)
                    reqNewline = true;
            }
            const iv = identity.isNode(item.value) ? item.value : null;
            if (iv) {
                if (iv.comment)
                    comment = iv.comment;
                if (iv.commentBefore)
                    reqNewline = true;
            }
            else if (item.value == null && ik?.comment) {
                comment = ik.comment;
            }
        }
        if (comment)
            reqNewline = true;
        let str = stringify.stringify(item, itemCtx, () => (comment = null));
        reqNewline || (reqNewline = lines.length > linesAtValue || str.includes('\n'));
        if (i < items.length - 1) {
            str += ',';
        }
        else if (ctx.options.trailingComma) {
            if (ctx.options.lineWidth > 0) {
                reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) +
                    (str.length + 2) >
                    ctx.options.lineWidth);
            }
            if (reqNewline) {
                str += ',';
            }
        }
        if (comment)
            str += stringifyComment.lineComment(str, itemIndent, commentString(comment));
        lines.push(str);
        linesAtValue = lines.length;
    }
    const { start, end } = flowChars;
    if (lines.length === 0) {
        return start + end;
    }
    else {
        if (!reqNewline) {
            const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
            reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
        }
        if (reqNewline) {
            let str = start;
            for (const line of lines)
                str += line ? `\n${indentStep}${indent}${line}` : '\n';
            return `${str}\n${indent}${end}`;
        }
        else {
            return `${start}${fcPadding}${lines.join(' ')}${fcPadding}${end}`;
        }
    }
}
function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
    if (comment && chompKeep)
        comment = comment.replace(/^\n+/, '');
    if (comment) {
        const ic = stringifyComment.indentComment(commentString(comment), indent);
        lines.push(ic.trimStart()); // Avoid double indent on first line
    }
}

exports.stringifyCollection = stringifyCollection;


/***/ }),

/***/ 9799:
/***/ ((__unused_webpack_module, exports) => {



/**
 * Stringifies a comment.
 *
 * Empty comment lines are left empty,
 * lines consisting of a single space are replaced by `#`,
 * and all other lines are prefixed with a `#`.
 */
const stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, '#');
function indentComment(comment, indent) {
    if (/^\n+$/.test(comment))
        return comment.substring(1);
    return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
}
const lineComment = (str, indent, comment) => str.endsWith('\n')
    ? indentComment(comment, indent)
    : comment.includes('\n')
        ? '\n' + indentComment(comment, indent)
        : (str.endsWith(' ') ? '' : ' ') + comment;

exports.indentComment = indentComment;
exports.lineComment = lineComment;
exports.stringifyComment = stringifyComment;


/***/ }),

/***/ 6829:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var identity = __nccwpck_require__(1127);
var stringify = __nccwpck_require__(2148);
var stringifyComment = __nccwpck_require__(9799);

function stringifyDocument(doc, options) {
    const lines = [];
    let hasDirectives = options.directives === true;
    if (options.directives !== false && doc.directives) {
        const dir = doc.directives.toString(doc);
        if (dir) {
            lines.push(dir);
            hasDirectives = true;
        }
        else if (doc.directives.docStart)
            hasDirectives = true;
    }
    if (hasDirectives)
        lines.push('---');
    const ctx = stringify.createStringifyContext(doc, options);
    const { commentString } = ctx.options;
    if (doc.commentBefore) {
        if (lines.length !== 1)
            lines.unshift('');
        const cs = commentString(doc.commentBefore);
        lines.unshift(stringifyComment.indentComment(cs, ''));
    }
    let chompKeep = false;
    let contentComment = null;
    if (doc.contents) {
        if (identity.isNode(doc.contents)) {
            if (doc.contents.spaceBefore && hasDirectives)
                lines.push('');
            if (doc.contents.commentBefore) {
                const cs = commentString(doc.contents.commentBefore);
                lines.push(stringifyComment.indentComment(cs, ''));
            }
            // top-level block scalars need to be indented if followed by a comment
            ctx.forceBlockIndent = !!doc.comment;
            contentComment = doc.contents.comment;
        }
        const onChompKeep = contentComment ? undefined : () => (chompKeep = true);
        let body = stringify.stringify(doc.contents, ctx, () => (contentComment = null), onChompKeep);
        if (contentComment)
            body += stringifyComment.lineComment(body, '', commentString(contentComment));
        if ((body[0] === '|' || body[0] === '>') &&
            lines[lines.length - 1] === '---') {
            // Top-level block scalars with a preceding doc marker ought to use the
            // same line for their header.
            lines[lines.length - 1] = `--- ${body}`;
        }
        else
            lines.push(body);
    }
    else {
        lines.push(stringify.stringify(doc.contents, ctx));
    }
    if (doc.directives?.docEnd) {
        if (doc.comment) {
            const cs = commentString(doc.comment);
            if (cs.includes('\n')) {
                lines.push('...');
                lines.push(stringifyComment.indentComment(cs, ''));
            }
            else {
                lines.push(`... ${cs}`);
            }
        }
        else {
            lines.push('...');
        }
    }
    else {
        let dc = doc.comment;
        if (dc && chompKeep)
            dc = dc.replace(/^\n+/, '');
        if (dc) {
            if ((!chompKeep || contentComment) && lines[lines.length - 1] !== '')
                lines.push('');
            lines.push(stringifyComment.indentComment(commentString(dc), ''));
        }
    }
    return lines.join('\n') + '\n';
}

exports.stringifyDocument = stringifyDocument;


/***/ }),

/***/ 8689:
/***/ ((__unused_webpack_module, exports) => {



function stringifyNumber({ format, minFractionDigits, tag, value }) {
    if (typeof value === 'bigint')
        return String(value);
    const num = typeof value === 'number' ? value : Number(value);
    if (!isFinite(num))
        return isNaN(num) ? '.nan' : num < 0 ? '-.inf' : '.inf';
    let n = Object.is(value, -0) ? '-0' : JSON.stringify(value);
    if (!format &&
        minFractionDigits &&
        (!tag || tag === 'tag:yaml.org,2002:float') &&
        /^-?\d/.test(n) &&
        !n.includes('e')) {
        let i = n.indexOf('.');
        if (i < 0) {
            i = n.length;
            n += '.';
        }
        let d = minFractionDigits - (n.length - i - 1);
        while (d-- > 0)
            n += '0';
    }
    return n;
}

exports.stringifyNumber = stringifyNumber;


/***/ }),

/***/ 9748:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var identity = __nccwpck_require__(1127);
var Scalar = __nccwpck_require__(3301);
var stringify = __nccwpck_require__(2148);
var stringifyComment = __nccwpck_require__(9799);

function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
    const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
    let keyComment = (identity.isNode(key) && key.comment) || null;
    if (simpleKeys) {
        if (keyComment) {
            throw new Error('With simple keys, key nodes cannot have comments');
        }
        if (identity.isCollection(key) || (!identity.isNode(key) && typeof key === 'object')) {
            const msg = 'With simple keys, collection cannot be used as a key value';
            throw new Error(msg);
        }
    }
    let explicitKey = !simpleKeys &&
        (!key ||
            (keyComment && value == null && !ctx.inFlow) ||
            identity.isCollection(key) ||
            (identity.isScalar(key)
                ? key.type === Scalar.Scalar.BLOCK_FOLDED || key.type === Scalar.Scalar.BLOCK_LITERAL
                : typeof key === 'object'));
    ctx = Object.assign({}, ctx, {
        allNullValues: false,
        implicitKey: !explicitKey && (simpleKeys || !allNullValues),
        indent: indent + indentStep
    });
    let keyCommentDone = false;
    let chompKeep = false;
    let str = stringify.stringify(key, ctx, () => (keyCommentDone = true), () => (chompKeep = true));
    if (!explicitKey && !ctx.inFlow && str.length > 1024) {
        if (simpleKeys)
            throw new Error('With simple keys, single line scalar must not span more than 1024 characters');
        explicitKey = true;
    }
    if (ctx.inFlow) {
        if (allNullValues || value == null) {
            if (keyCommentDone && onComment)
                onComment();
            return str === '' ? '?' : explicitKey ? `? ${str}` : str;
        }
    }
    else if ((allNullValues && !simpleKeys) || (value == null && explicitKey)) {
        str = `? ${str}`;
        if (keyComment && !keyCommentDone) {
            str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        }
        else if (chompKeep && onChompKeep)
            onChompKeep();
        return str;
    }
    if (keyCommentDone)
        keyComment = null;
    if (explicitKey) {
        if (keyComment)
            str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        str = `? ${str}\n${indent}:`;
    }
    else {
        str = `${str}:`;
        if (keyComment)
            str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
    }
    let vsb, vcb, valueComment;
    if (identity.isNode(value)) {
        vsb = !!value.spaceBefore;
        vcb = value.commentBefore;
        valueComment = value.comment;
    }
    else {
        vsb = false;
        vcb = null;
        valueComment = null;
        if (value && typeof value === 'object')
            value = doc.createNode(value);
    }
    ctx.implicitKey = false;
    if (!explicitKey && !keyComment && identity.isScalar(value))
        ctx.indentAtStart = str.length + 1;
    chompKeep = false;
    if (!indentSeq &&
        indentStep.length >= 2 &&
        !ctx.inFlow &&
        !explicitKey &&
        identity.isSeq(value) &&
        !value.flow &&
        !value.tag &&
        !value.anchor) {
        // If indentSeq === false, consider '- ' as part of indentation where possible
        ctx.indent = ctx.indent.substring(2);
    }
    let valueCommentDone = false;
    const valueStr = stringify.stringify(value, ctx, () => (valueCommentDone = true), () => (chompKeep = true));
    let ws = ' ';
    if (keyComment || vsb || vcb) {
        ws = vsb ? '\n' : '';
        if (vcb) {
            const cs = commentString(vcb);
            ws += `\n${stringifyComment.indentComment(cs, ctx.indent)}`;
        }
        if (valueStr === '' && !ctx.inFlow) {
            if (ws === '\n' && valueComment)
                ws = '\n\n';
        }
        else {
            ws += `\n${ctx.indent}`;
        }
    }
    else if (!explicitKey && identity.isCollection(value)) {
        const vs0 = valueStr[0];
        const nl0 = valueStr.indexOf('\n');
        const hasNewline = nl0 !== -1;
        const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
        if (hasNewline || !flow) {
            let hasPropsLine = false;
            if (hasNewline && (vs0 === '&' || vs0 === '!')) {
                let sp0 = valueStr.indexOf(' ');
                if (vs0 === '&' &&
                    sp0 !== -1 &&
                    sp0 < nl0 &&
                    valueStr[sp0 + 1] === '!') {
                    sp0 = valueStr.indexOf(' ', sp0 + 1);
                }
                if (sp0 === -1 || nl0 < sp0)
                    hasPropsLine = true;
            }
            if (!hasPropsLine)
                ws = `\n${ctx.indent}`;
        }
    }
    else if (valueStr === '' || valueStr[0] === '\n') {
        ws = '';
    }
    str += ws + valueStr;
    if (ctx.inFlow) {
        if (valueCommentDone && onComment)
            onComment();
    }
    else if (valueComment && !valueCommentDone) {
        str += stringifyComment.lineComment(str, ctx.indent, commentString(valueComment));
    }
    else if (chompKeep && onChompKeep) {
        onChompKeep();
    }
    return str;
}

exports.stringifyPair = stringifyPair;


/***/ }),

/***/ 3069:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var Scalar = __nccwpck_require__(3301);
var foldFlowLines = __nccwpck_require__(4475);

const getFoldOptions = (ctx, isBlock) => ({
    indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
    lineWidth: ctx.options.lineWidth,
    minContentWidth: ctx.options.minContentWidth
});
// Also checks for lines starting with %, as parsing the output as YAML 1.1 will
// presume that's starting a new document.
const containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
function lineLengthOverLimit(str, lineWidth, indentLength) {
    if (!lineWidth || lineWidth < 0)
        return false;
    const limit = lineWidth - indentLength;
    const strLen = str.length;
    if (strLen <= limit)
        return false;
    for (let i = 0, start = 0; i < strLen; ++i) {
        if (str[i] === '\n') {
            if (i - start > limit)
                return true;
            start = i + 1;
            if (strLen - start <= limit)
                return false;
        }
    }
    return true;
}
function doubleQuotedString(value, ctx) {
    const json = JSON.stringify(value);
    if (ctx.options.doubleQuotedAsJSON)
        return json;
    const { implicitKey } = ctx;
    const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
    const indent = ctx.indent || (containsDocumentMarker(value) ? '  ' : '');
    let str = '';
    let start = 0;
    for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
        if (ch === ' ' && json[i + 1] === '\\' && json[i + 2] === 'n') {
            // space before newline needs to be escaped to not be folded
            str += json.slice(start, i) + '\\ ';
            i += 1;
            start = i;
            ch = '\\';
        }
        if (ch === '\\')
            switch (json[i + 1]) {
                case 'u':
                    {
                        str += json.slice(start, i);
                        const code = json.substr(i + 2, 4);
                        switch (code) {
                            case '0000':
                                str += '\\0';
                                break;
                            case '0007':
                                str += '\\a';
                                break;
                            case '000b':
                                str += '\\v';
                                break;
                            case '001b':
                                str += '\\e';
                                break;
                            case '0085':
                                str += '\\N';
                                break;
                            case '00a0':
                                str += '\\_';
                                break;
                            case '2028':
                                str += '\\L';
                                break;
                            case '2029':
                                str += '\\P';
                                break;
                            default:
                                if (code.substr(0, 2) === '00')
                                    str += '\\x' + code.substr(2);
                                else
                                    str += json.substr(i, 6);
                        }
                        i += 5;
                        start = i + 1;
                    }
                    break;
                case 'n':
                    if (implicitKey ||
                        json[i + 2] === '"' ||
                        json.length < minMultiLineLength) {
                        i += 1;
                    }
                    else {
                        // folding will eat first newline
                        str += json.slice(start, i) + '\n\n';
                        while (json[i + 2] === '\\' &&
                            json[i + 3] === 'n' &&
                            json[i + 4] !== '"') {
                            str += '\n';
                            i += 2;
                        }
                        str += indent;
                        // space after newline needs to be escaped to not be folded
                        if (json[i + 2] === ' ')
                            str += '\\';
                        i += 1;
                        start = i + 1;
                    }
                    break;
                default:
                    i += 1;
            }
    }
    str = start ? str + json.slice(start) : json;
    return implicitKey
        ? str
        : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_QUOTED, getFoldOptions(ctx, false));
}
function singleQuotedString(value, ctx) {
    if (ctx.options.singleQuote === false ||
        (ctx.implicitKey && value.includes('\n')) ||
        /[ \t]\n|\n[ \t]/.test(value) // single quoted string can't have leading or trailing whitespace around newline
    )
        return doubleQuotedString(value, ctx);
    const indent = ctx.indent || (containsDocumentMarker(value) ? '  ' : '');
    const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&\n${indent}`) + "'";
    return ctx.implicitKey
        ? res
        : foldFlowLines.foldFlowLines(res, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
}
function quotedString(value, ctx) {
    const { singleQuote } = ctx.options;
    let qs;
    if (singleQuote === false)
        qs = doubleQuotedString;
    else {
        const hasDouble = value.includes('"');
        const hasSingle = value.includes("'");
        if (hasDouble && !hasSingle)
            qs = singleQuotedString;
        else if (hasSingle && !hasDouble)
            qs = doubleQuotedString;
        else
            qs = singleQuote ? singleQuotedString : doubleQuotedString;
    }
    return qs(value, ctx);
}
// The negative lookbehind avoids a polynomial search,
// but isn't supported yet on Safari: https://caniuse.com/js-regexp-lookbehind
let blockEndNewlines;
try {
    blockEndNewlines = new RegExp('(^|(?<!\n))\n+(?!\n|$)', 'g');
}
catch {
    blockEndNewlines = /\n+(?!\n|$)/g;
}
function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
    const { blockQuote, commentString, lineWidth } = ctx.options;
    // 1. Block can't end in whitespace unless the last line is non-empty.
    // 2. Strings consisting of only whitespace are best rendered explicitly.
    if (!blockQuote || /\n[\t ]+$/.test(value)) {
        return quotedString(value, ctx);
    }
    const indent = ctx.indent ||
        (ctx.forceBlockIndent || containsDocumentMarker(value) ? '  ' : '');
    const literal = blockQuote === 'literal'
        ? true
        : blockQuote === 'folded' || type === Scalar.Scalar.BLOCK_FOLDED
            ? false
            : type === Scalar.Scalar.BLOCK_LITERAL
                ? true
                : !lineLengthOverLimit(value, lineWidth, indent.length);
    if (!value)
        return literal ? '|\n' : '>\n';
    // determine chomping from whitespace at value end
    let chomp;
    let endStart;
    for (endStart = value.length; endStart > 0; --endStart) {
        const ch = value[endStart - 1];
        if (ch !== '\n' && ch !== '\t' && ch !== ' ')
            break;
    }
    let end = value.substring(endStart);
    const endNlPos = end.indexOf('\n');
    if (endNlPos === -1) {
        chomp = '-'; // strip
    }
    else if (value === end || endNlPos !== end.length - 1) {
        chomp = '+'; // keep
        if (onChompKeep)
            onChompKeep();
    }
    else {
        chomp = ''; // clip
    }
    if (end) {
        value = value.slice(0, -end.length);
        if (end[end.length - 1] === '\n')
            end = end.slice(0, -1);
        end = end.replace(blockEndNewlines, `$&${indent}`);
    }
    // determine indent indicator from whitespace at value start
    let startWithSpace = false;
    let startEnd;
    let startNlPos = -1;
    for (startEnd = 0; startEnd < value.length; ++startEnd) {
        const ch = value[startEnd];
        if (ch === ' ')
            startWithSpace = true;
        else if (ch === '\n')
            startNlPos = startEnd;
        else
            break;
    }
    let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
    if (start) {
        value = value.substring(start.length);
        start = start.replace(/\n+/g, `$&${indent}`);
    }
    const indentSize = indent ? '2' : '1'; // root is at -1
    // Leading | or > is added later
    let header = (startWithSpace ? indentSize : '') + chomp;
    if (comment) {
        header += ' ' + commentString(comment.replace(/ ?[\r\n]+/g, ' '));
        if (onComment)
            onComment();
    }
    if (!literal) {
        const foldedValue = value
            .replace(/\n+/g, '\n$&')
            .replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, '$1$2') // more-indented lines aren't folded
            //                ^ more-ind. ^ empty     ^ capture next empty lines only at end of indent
            .replace(/\n+/g, `$&${indent}`);
        let literalFallback = false;
        const foldOptions = getFoldOptions(ctx, true);
        if (blockQuote !== 'folded' && type !== Scalar.Scalar.BLOCK_FOLDED) {
            foldOptions.onOverflow = () => {
                literalFallback = true;
            };
        }
        const body = foldFlowLines.foldFlowLines(`${start}${foldedValue}${end}`, indent, foldFlowLines.FOLD_BLOCK, foldOptions);
        if (!literalFallback)
            return `>${header}\n${indent}${body}`;
    }
    value = value.replace(/\n+/g, `$&${indent}`);
    return `|${header}\n${indent}${start}${value}${end}`;
}
function plainString(item, ctx, onComment, onChompKeep) {
    const { type, value } = item;
    const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
    if ((implicitKey && value.includes('\n')) ||
        (inFlow && /[[\]{},]/.test(value))) {
        return quotedString(value, ctx);
    }
    if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
        // not allowed:
        // - '-' or '?'
        // - start with an indicator character (except [?:-]) or /[?-] /
        // - '\n ', ': ' or ' \n' anywhere
        // - '#' not preceded by a non-space char
        // - end with ' ' or ':'
        return implicitKey || inFlow || !value.includes('\n')
            ? quotedString(value, ctx)
            : blockString(item, ctx, onComment, onChompKeep);
    }
    if (!implicitKey &&
        !inFlow &&
        type !== Scalar.Scalar.PLAIN &&
        value.includes('\n')) {
        // Where allowed & type not set explicitly, prefer block style for multiline strings
        return blockString(item, ctx, onComment, onChompKeep);
    }
    if (containsDocumentMarker(value)) {
        if (indent === '') {
            ctx.forceBlockIndent = true;
            return blockString(item, ctx, onComment, onChompKeep);
        }
        else if (implicitKey && indent === indentStep) {
            return quotedString(value, ctx);
        }
    }
    const str = value.replace(/\n+/g, `$&\n${indent}`);
    // Verify that output will be parsed as a string, as e.g. plain numbers and
    // booleans get parsed with those types in v1.2 (e.g. '42', 'true' & '0.9e-3'),
    // and others in v1.1.
    if (actualString) {
        const test = (tag) => tag.default && tag.tag !== 'tag:yaml.org,2002:str' && tag.test?.test(str);
        const { compat, tags } = ctx.doc.schema;
        if (tags.some(test) || compat?.some(test))
            return quotedString(value, ctx);
    }
    return implicitKey
        ? str
        : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
}
function stringifyString(item, ctx, onComment, onChompKeep) {
    const { implicitKey, inFlow } = ctx;
    const ss = typeof item.value === 'string'
        ? item
        : Object.assign({}, item, { value: String(item.value) });
    let { type } = item;
    if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
        // force double quotes on control characters & unpaired surrogates
        if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
            type = Scalar.Scalar.QUOTE_DOUBLE;
    }
    const _stringify = (_type) => {
        switch (_type) {
            case Scalar.Scalar.BLOCK_FOLDED:
            case Scalar.Scalar.BLOCK_LITERAL:
                return implicitKey || inFlow
                    ? quotedString(ss.value, ctx) // blocks are not valid inside flow containers
                    : blockString(ss, ctx, onComment, onChompKeep);
            case Scalar.Scalar.QUOTE_DOUBLE:
                return doubleQuotedString(ss.value, ctx);
            case Scalar.Scalar.QUOTE_SINGLE:
                return singleQuotedString(ss.value, ctx);
            case Scalar.Scalar.PLAIN:
                return plainString(ss, ctx, onComment, onChompKeep);
            default:
                return null;
        }
    };
    let res = _stringify(type);
    if (res === null) {
        const { defaultKeyType, defaultStringType } = ctx.options;
        const t = (implicitKey && defaultKeyType) || defaultStringType;
        res = _stringify(t);
        if (res === null)
            throw new Error(`Unsupported default string type ${t}`);
    }
    return res;
}

exports.stringifyString = stringifyString;


/***/ }),

/***/ 204:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {



var identity = __nccwpck_require__(1127);

const BREAK = Symbol('break visit');
const SKIP = Symbol('skip children');
const REMOVE = Symbol('remove node');
/**
 * Apply a visitor to an AST node or document.
 *
 * Walks through the tree (depth-first) starting from `node`, calling a
 * `visitor` function with three arguments:
 *   - `key`: For sequence values and map `Pair`, the node's index in the
 *     collection. Within a `Pair`, `'key'` or `'value'`, correspondingly.
 *     `null` for the root node.
 *   - `node`: The current node.
 *   - `path`: The ancestry of the current node.
 *
 * The return value of the visitor may be used to control the traversal:
 *   - `undefined` (default): Do nothing and continue
 *   - `visit.SKIP`: Do not visit the children of this node, continue with next
 *     sibling
 *   - `visit.BREAK`: Terminate traversal completely
 *   - `visit.REMOVE`: Remove the current node, then continue with the next one
 *   - `Node`: Replace the current node, then continue by visiting it
 *   - `number`: While iterating the items of a sequence or map, set the index
 *     of the next step. This is useful especially if the index of the current
 *     node has changed.
 *
 * If `visitor` is a single function, it will be called with all values
 * encountered in the tree, including e.g. `null` values. Alternatively,
 * separate visitor functions may be defined for each `Map`, `Pair`, `Seq`,
 * `Alias` and `Scalar` node. To define the same visitor function for more than
 * one node type, use the `Collection` (map and seq), `Value` (map, seq & scalar)
 * and `Node` (alias, map, seq & scalar) targets. Of all these, only the most
 * specific defined one will be used for each node.
 */
function visit(node, visitor) {
    const visitor_ = initVisitor(visitor);
    if (identity.isDocument(node)) {
        const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
            node.contents = null;
    }
    else
        visit_(null, node, visitor_, Object.freeze([]));
}
// Without the `as symbol` casts, TS declares these in the `visit`
// namespace using `var`, but then complains about that because
// `unique symbol` must be `const`.
/** Terminate visit traversal completely */
visit.BREAK = BREAK;
/** Do not visit the children of the current node */
visit.SKIP = SKIP;
/** Remove the current node */
visit.REMOVE = REMOVE;
function visit_(key, node, visitor, path) {
    const ctrl = callVisitor(key, node, visitor, path);
    if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visit_(key, ctrl, visitor, path);
    }
    if (typeof ctrl !== 'symbol') {
        if (identity.isCollection(node)) {
            path = Object.freeze(path.concat(node));
            for (let i = 0; i < node.items.length; ++i) {
                const ci = visit_(i, node.items[i], visitor, path);
                if (typeof ci === 'number')
                    i = ci - 1;
                else if (ci === BREAK)
                    return BREAK;
                else if (ci === REMOVE) {
                    node.items.splice(i, 1);
                    i -= 1;
                }
            }
        }
        else if (identity.isPair(node)) {
            path = Object.freeze(path.concat(node));
            const ck = visit_('key', node.key, visitor, path);
            if (ck === BREAK)
                return BREAK;
            else if (ck === REMOVE)
                node.key = null;
            const cv = visit_('value', node.value, visitor, path);
            if (cv === BREAK)
                return BREAK;
            else if (cv === REMOVE)
                node.value = null;
        }
    }
    return ctrl;
}
/**
 * Apply an async visitor to an AST node or document.
 *
 * Walks through the tree (depth-first) starting from `node`, calling a
 * `visitor` function with three arguments:
 *   - `key`: For sequence values and map `Pair`, the node's index in the
 *     collection. Within a `Pair`, `'key'` or `'value'`, correspondingly.
 *     `null` for the root node.
 *   - `node`: The current node.
 *   - `path`: The ancestry of the current node.
 *
 * The return value of the visitor may be used to control the traversal:
 *   - `Promise`: Must resolve to one of the following values
 *   - `undefined` (default): Do nothing and continue
 *   - `visit.SKIP`: Do not visit the children of this node, continue with next
 *     sibling
 *   - `visit.BREAK`: Terminate traversal completely
 *   - `visit.REMOVE`: Remove the current node, then continue with the next one
 *   - `Node`: Replace the current node, then continue by visiting it
 *   - `number`: While iterating the items of a sequence or map, set the index
 *     of the next step. This is useful especially if the index of the current
 *     node has changed.
 *
 * If `visitor` is a single function, it will be called with all values
 * encountered in the tree, including e.g. `null` values. Alternatively,
 * separate visitor functions may be defined for each `Map`, `Pair`, `Seq`,
 * `Alias` and `Scalar` node. To define the same visitor function for more than
 * one node type, use the `Collection` (map and seq), `Value` (map, seq & scalar)
 * and `Node` (alias, map, seq & scalar) targets. Of all these, only the most
 * specific defined one will be used for each node.
 */
async function visitAsync(node, visitor) {
    const visitor_ = initVisitor(visitor);
    if (identity.isDocument(node)) {
        const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
            node.contents = null;
    }
    else
        await visitAsync_(null, node, visitor_, Object.freeze([]));
}
// Without the `as symbol` casts, TS declares these in the `visit`
// namespace using `var`, but then complains about that because
// `unique symbol` must be `const`.
/** Terminate visit traversal completely */
visitAsync.BREAK = BREAK;
/** Do not visit the children of the current node */
visitAsync.SKIP = SKIP;
/** Remove the current node */
visitAsync.REMOVE = REMOVE;
async function visitAsync_(key, node, visitor, path) {
    const ctrl = await callVisitor(key, node, visitor, path);
    if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visitAsync_(key, ctrl, visitor, path);
    }
    if (typeof ctrl !== 'symbol') {
        if (identity.isCollection(node)) {
            path = Object.freeze(path.concat(node));
            for (let i = 0; i < node.items.length; ++i) {
                const ci = await visitAsync_(i, node.items[i], visitor, path);
                if (typeof ci === 'number')
                    i = ci - 1;
                else if (ci === BREAK)
                    return BREAK;
                else if (ci === REMOVE) {
                    node.items.splice(i, 1);
                    i -= 1;
                }
            }
        }
        else if (identity.isPair(node)) {
            path = Object.freeze(path.concat(node));
            const ck = await visitAsync_('key', node.key, visitor, path);
            if (ck === BREAK)
                return BREAK;
            else if (ck === REMOVE)
                node.key = null;
            const cv = await visitAsync_('value', node.value, visitor, path);
            if (cv === BREAK)
                return BREAK;
            else if (cv === REMOVE)
                node.value = null;
        }
    }
    return ctrl;
}
function initVisitor(visitor) {
    if (typeof visitor === 'object' &&
        (visitor.Collection || visitor.Node || visitor.Value)) {
        return Object.assign({
            Alias: visitor.Node,
            Map: visitor.Node,
            Scalar: visitor.Node,
            Seq: visitor.Node
        }, visitor.Value && {
            Map: visitor.Value,
            Scalar: visitor.Value,
            Seq: visitor.Value
        }, visitor.Collection && {
            Map: visitor.Collection,
            Seq: visitor.Collection
        }, visitor);
    }
    return visitor;
}
function callVisitor(key, node, visitor, path) {
    if (typeof visitor === 'function')
        return visitor(key, node, path);
    if (identity.isMap(node))
        return visitor.Map?.(key, node, path);
    if (identity.isSeq(node))
        return visitor.Seq?.(key, node, path);
    if (identity.isPair(node))
        return visitor.Pair?.(key, node, path);
    if (identity.isScalar(node))
        return visitor.Scalar?.(key, node, path);
    if (identity.isAlias(node))
        return visitor.Alias?.(key, node, path);
    return undefined;
}
function replaceNode(key, path, node) {
    const parent = path[path.length - 1];
    if (identity.isCollection(parent)) {
        parent.items[key] = node;
    }
    else if (identity.isPair(parent)) {
        if (key === 'key')
            parent.key = node;
        else
            parent.value = node;
    }
    else if (identity.isDocument(parent)) {
        parent.contents = node;
    }
    else {
        const pt = identity.isAlias(parent) ? 'alias' : 'scalar';
        throw new Error(`Cannot replace node with ${pt} parent`);
    }
}

exports.visit = visit;
exports.visitAsync = visitAsync;


/***/ })

/******/ });
/************************************************************************/
/******/ // The module cache
/******/ var __webpack_module_cache__ = {};
/******/ 
/******/ // The require function
/******/ function __nccwpck_require__(moduleId) {
/******/ 	// Check if module is in cache
/******/ 	var cachedModule = __webpack_module_cache__[moduleId];
/******/ 	if (cachedModule !== undefined) {
/******/ 		return cachedModule.exports;
/******/ 	}
/******/ 	// Create a new module (and put it into the cache)
/******/ 	var module = __webpack_module_cache__[moduleId] = {
/******/ 		id: moduleId,
/******/ 		loaded: false,
/******/ 		exports: {}
/******/ 	};
/******/ 
/******/ 	// Execute the module function
/******/ 	var threw = true;
/******/ 	try {
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __nccwpck_require__);
/******/ 		threw = false;
/******/ 	} finally {
/******/ 		if(threw) delete __webpack_module_cache__[moduleId];
/******/ 	}
/******/ 
/******/ 	// Flag the module as loaded
/******/ 	module.loaded = true;
/******/ 
/******/ 	// Return the exports of the module
/******/ 	return module.exports;
/******/ }
/******/ 
/************************************************************************/
/******/ /* webpack/runtime/compat get default export */
/******/ (() => {
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__nccwpck_require__.n = (module) => {
/******/ 		var getter = module && module.__esModule ?
/******/ 			() => (module['default']) :
/******/ 			() => (module);
/******/ 		__nccwpck_require__.d(getter, { a: getter });
/******/ 		return getter;
/******/ 	};
/******/ })();
/******/ 
/******/ /* webpack/runtime/define property getters */
/******/ (() => {
/******/ 	// define getter functions for harmony exports
/******/ 	__nccwpck_require__.d = (exports, definition) => {
/******/ 		for(var key in definition) {
/******/ 			if(__nccwpck_require__.o(definition, key) && !__nccwpck_require__.o(exports, key)) {
/******/ 				Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 			}
/******/ 		}
/******/ 	};
/******/ })();
/******/ 
/******/ /* webpack/runtime/hasOwnProperty shorthand */
/******/ (() => {
/******/ 	__nccwpck_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ })();
/******/ 
/******/ /* webpack/runtime/node module decorator */
/******/ (() => {
/******/ 	__nccwpck_require__.nmd = (module) => {
/******/ 		module.paths = [];
/******/ 		if (!module.children) module.children = [];
/******/ 		return module;
/******/ 	};
/******/ })();
/******/ 
/******/ /* webpack/runtime/compat */
/******/ 
/******/ if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = new URL('.', import.meta.url).pathname.slice(import.meta.url.match(/^file:\/\/\/\w:/) ? 1 : 0, -1) + "/";
/******/ 
/************************************************************************/
var __webpack_exports__ = {};

// EXPORTS
__nccwpck_require__.d(__webpack_exports__, {
  p: () => (/* binding */ naturalCompare),
  a: () => (/* binding */ selectFirstByOrder)
});

;// CONCATENATED MODULE: external "fs"
const external_fs_namespaceObject = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("fs");
// EXTERNAL MODULE: ./node_modules/yaml/dist/index.js
var dist = __nccwpck_require__(8815);
;// CONCATENATED MODULE: ./src/config.ts


function loadConfig(configPath = "./config.yml") {
    const content = (0,external_fs_namespaceObject.readFileSync)(configPath, "utf-8");
    return (0,dist/* parse */.qg)(content);
}
function loadWatchers(watchersPath = "watchers.yml") {
    const content = (0,external_fs_namespaceObject.readFileSync)(watchersPath, "utf-8");
    const doc = (0,dist/* parseDocument */.Tp)(content);
    return doc.toJS();
}
function saveWatchers(watchers, watchersPath = "watchers.yml") {
    // Read existing file to preserve comments
    const existingContent = (0,external_fs_namespaceObject.readFileSync)(watchersPath, "utf-8");
    const doc = (0,dist/* parseDocument */.Tp)(existingContent);
    // Update sites in the document
    if (doc.contents && typeof doc.contents === 'object') {
        const yamlMap = doc.contents;
        const sites = yamlMap.get('sites');
        if (sites && typeof sites === 'object') {
            // Update each site
            Object.keys(watchers.sites).forEach(key => {
                sites.set(key, watchers.sites[key]);
            });
        }
    }
    const content = (0,dist/* stringify */.As)(doc);
    (0,external_fs_namespaceObject.writeFileSync)(watchersPath, content, "utf-8");
}

;// CONCATENATED MODULE: ./src/probe.ts
class ContentProbe {
    config;
    constructor(config) {
        this.config = config;
    }
    async verify(probeTexts, responseBody) {
        if (!this.config.contentProbe.enabled || probeTexts.length === 0) {
            return true; // Skip if disabled or no probe texts
        }
        // If no response body provided, cannot verify
        if (!responseBody) {
            return false;
        }
        // Check if all probe texts are present
        for (const text of probeTexts) {
            if (!responseBody.includes(text)) {
                return false;
            }
        }
        return true;
    }
}

;// CONCATENATED MODULE: external "path"
const external_path_namespaceObject = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("path");
var external_path_default = /*#__PURE__*/__nccwpck_require__.n(external_path_namespaceObject);
;// CONCATENATED MODULE: ./src/logger.ts
// Unified logger with log levels and configurable outputs


var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
    LogLevel[LogLevel["SUMMARY"] = 4] = "SUMMARY";
    LogLevel[LogLevel["RAW"] = 5] = "RAW"; // Always visible, no level prefix
})(LogLevel || (LogLevel = {}));
class Logger {
    logBuffer = [];
    config = null;
    logConfig;
    runMode;
    separator = "=".repeat(80);
    constructor(config, runMode) {
        this.config = config || null;
        this.runMode = runMode || this.detectRunMode();
        this.logConfig = this.createLogConfig(this.runMode);
    }
    detectRunMode() {
        const args = process.argv.slice(2);
        const cliMode = args.find(arg => arg.startsWith('--mode='))?.split('=')[1];
        const mode = process.env.INPUT_MODE || cliMode || 'prod_live';
        // Validate and return mode
        const validModes = ['prod_live', 'prod_dry', 'test_live', 'test_dry'];
        return validModes.includes(mode) ? mode : 'prod_live';
    }
    createLogConfig(mode) {
        const isTestMode = mode === 'test_dry' || mode === 'test_live';
        return {
            fileLevel: isTestMode ? LogLevel.DEBUG : LogLevel.SUMMARY,
            consoleLevel: isTestMode ? LogLevel.DEBUG : LogLevel.INFO,
            outputs: {
                file: true,
                console: true
            },
            filters: {
                excludeChangesByFile: !isTestMode,
                excludeMainSeparator: true,
            }
        };
    }
    formatTimestamp(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        const ms = String(date.getMilliseconds()).padStart(3, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
    }
    log(level, site, message) {
        const timestamp = this.formatTimestamp(new Date());
        const levelName = LogLevel[level];
        const siteQuoted = site ? `"${site}"` : '';
        // For RAW level, don't include level prefix
        const formattedMessage = level === LogLevel.RAW
            ? `${timestamp} ${message}`
            : site
                ? `${timestamp} ${levelName} ${siteQuoted} ${message}`
                : `${timestamp} ${levelName} ${message}`;
        // Write to file (RAW always writes, others respect level)
        if (this.logConfig.outputs.file && (level === LogLevel.RAW || level >= this.logConfig.fileLevel)) {
            this.logBuffer.push(formattedMessage);
        }
        // Write to console (RAW always writes, others respect level)
        if (this.logConfig.outputs.console && (level === LogLevel.RAW || level >= this.logConfig.consoleLevel)) {
            console.log(formattedMessage);
        }
    }
    debug(site, message) {
        this.log(LogLevel.DEBUG, site, message);
    }
    info(site, message) {
        this.log(LogLevel.INFO, site, message);
    }
    warn(site, message) {
        this.log(LogLevel.WARN, site, message);
    }
    error(site, message) {
        this.log(LogLevel.ERROR, site, message);
    }
    summary(site, message) {
        this.log(LogLevel.SUMMARY, site, message);
    }
    // For messages without site context
    logGlobal(level, message) {
        this.log(level, '', message);
    }
    // For raw messages without timestamp
    logRaw(message) {
        // Write to console
        if (this.logConfig.outputs.console) {
            console.log(message);
        }
        // Write to file
        if (this.logConfig.outputs.file) {
            this.logBuffer.push(message);
        }
    }
    shouldLogChangesByFile() {
        return !this.logConfig.filters.excludeChangesByFile;
    }
    getRunMode() {
        return this.runMode;
    }
    saveToFile() {
        if (!this.config?.logging.saveToFile) {
            return;
        }
        const filePath = this.config.logging.filePath;
        const incremental = this.config.logging.incremental;
        // Ensure directory exists
        const dir = (0,external_path_namespaceObject.dirname)(filePath);
        if (!(0,external_fs_namespaceObject.existsSync)(dir)) {
            (0,external_fs_namespaceObject.mkdirSync)(dir, { recursive: true });
        }
        // Rotate logs if needed
        if (incremental && (0,external_fs_namespaceObject.existsSync)(filePath)) {
            this.rotateLogs(filePath);
        }
        // Build log content
        const now = new Date();
        const timestamp = this.formatTimestamp(now);
        const lines = [];
        if (incremental && (0,external_fs_namespaceObject.existsSync)(filePath)) {
            lines.push("");
            lines.push(this.separator);
        }
        lines.push(`Run: ${timestamp}`);
        lines.push(this.separator);
        lines.push("");
        // Add buffered logs
        lines.push(...this.logBuffer);
        lines.push("");
        const content = lines.join("\n");
        if (incremental) {
            (0,external_fs_namespaceObject.appendFileSync)(filePath, content, "utf-8");
        }
        else {
            (0,external_fs_namespaceObject.writeFileSync)(filePath, content, "utf-8");
        }
        this.logGlobal(LogLevel.INFO, `Logs saved to: ${filePath}`);
    }
    rotateLogs(filePath) {
        try {
            const stats = (0,external_fs_namespaceObject.statSync)(filePath);
            const maxSize = 5 * 1024 * 1024; // 5MB
            // Check file size
            if (stats.size >= maxSize) {
                (0,external_fs_namespaceObject.unlinkSync)(filePath);
                return;
            }
            // Check number of runs
            const content = (0,external_fs_namespaceObject.readFileSync)(filePath, 'utf-8');
            const runMatches = content.match(/^Run: /gm);
            const runCount = runMatches ? runMatches.length : 0;
            if (runCount >= 28) {
                // Keep only last 4 runs
                const lines = content.split('\n');
                const runIndices = [];
                lines.forEach((line, index) => {
                    if (line.startsWith('Run: ')) {
                        runIndices.push(index);
                    }
                });
                if (runIndices.length >= 5) {
                    // Find the separator before the 2nd run (to keep last 4)
                    const keepFromIndex = runIndices[runIndices.length - 4];
                    let separatorIndex = keepFromIndex - 1;
                    // Find the separator line before this run
                    while (separatorIndex > 0 && !lines[separatorIndex].startsWith('===')) {
                        separatorIndex--;
                    }
                    const keptContent = lines.slice(separatorIndex).join('\n');
                    (0,external_fs_namespaceObject.writeFileSync)(filePath, keptContent, 'utf-8');
                }
            }
        }
        catch (error) {
            // Ignore rotation errors
        }
    }
}

;// CONCATENATED MODULE: external "dns"
const external_dns_namespaceObject = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("dns");
;// CONCATENATED MODULE: ./src/batch.ts



class BatchProcessor {
    config;
    watchers;
    logger;
    resolver;
    probe;
    constructor(config, watchers, logger, resolver) {
        this.config = config;
        this.watchers = watchers;
        this.logger = logger;
        this.resolver = resolver;
        this.probe = new ContentProbe(config);
    }
    /**
     * Tokenize domain into structured parts (runtime only, not persisted)
     */
    tokenizeDomain(domain) {
        const normalized = domain.startsWith('http://') || domain.startsWith('https://')
            ? domain
            : `https://${domain}`;
        let hostname = this.resolver.extractHostWithoutQuery(normalized);
        hostname = hostname.replace(/^www\./, '');
        // Pattern 1: domain[N].tld or domain[N][text].tld (kodtimetv16.com, sahatv5.top, betist213tv.live)
        let match = hostname.match(/^([a-z-]+?)(\d+)([a-z-]*)(\.[a-z]+)$/i);
        if (match) {
            return {
                original: domain,
                hostname,
                isPattern: true,
                patternType: 'numeric',
                parts: { prefix: match[1], variable: match[2], suffix: match[4] }
            };
        }
        // Pattern 2: [N]domain.tld (14dizipal.com)
        match = hostname.match(/^(\d+)([a-z-]+)(\.[a-z]+)$/i);
        if (match) {
            return {
                original: domain,
                hostname,
                isPattern: true,
                patternType: 'numeric',
                parts: { prefix: match[2], variable: match[1], suffix: match[3] }
            };
        }
        return { original: domain, hostname, isPattern: false };
    }
    /**
     * Check if domain matches numeric pattern (backward compatibility wrapper)
     */
    matchesNumericPattern(domain) {
        const token = this.tokenizeDomain(domain);
        return token.isPattern;
    }
    /**
     * Group history domains by pattern (on the fly)
     */
    groupHistoryByPattern(history) {
        const grouped = new Map();
        for (const domain of history) {
            const token = this.tokenizeDomain(domain);
            if (!token.isPattern)
                continue;
            const key = `${token.parts.prefix}[N]${token.parts.suffix}`;
            if (!grouped.has(key)) {
                grouped.set(key, []);
            }
            grouped.get(key).push(domain);
        }
        return grouped;
    }
    updateDomainHistory(site, newDomain, oldLastKnownMirror) {
        const token = this.tokenizeDomain(newDomain);
        if (token.isPattern) {
            // Pattern domain - reset flags (delete from config)
            delete site.pattern_changed;
            // Pattern → Pattern: DO NOT create history (just rotation)
            // History is only needed when switching FROM pattern TO non-pattern
            // So we delete any existing history when staying on pattern domains
            delete site.heuristic_history;
        }
        else {
            // Non-pattern domain - set flag
            // IMPORTANT: Save OLD last_known_mirror (pattern domain) to history BEFORE overwriting
            if (oldLastKnownMirror && this.matchesNumericPattern(oldLastKnownMirror)) {
                // Store only the last pattern domain before switching to non-pattern
                site.heuristic_history = [oldLastKnownMirror];
            }
            site.pattern_changed = true;
        }
    }
    calculateDaysSince(dateStr) {
        if (!dateStr || dateStr.trim() === '')
            return 0;
        try {
            const past = new Date(dateStr.replace(" ", "T"));
            const now = new Date();
            const diffTime = Math.abs(now.getTime() - past.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays;
        }
        catch {
            return 0;
        }
    }
    /**
     * Check if a URL resolves via DNS
     * @param url - URL to check
     * @returns true if DNS resolves, false otherwise
     */
    async checkDnsResolution(url) {
        const dnsConfig = this.config.dnsPreCheck;
        if (!dnsConfig.enabled) {
            return true;
        }
        const timeout = dnsConfig.timeout;
        const retryOnce = dnsConfig.retryOnce;
        const raceWithTimeout = (promise, ms) => {
            let timerId;
            const timeoutPromise = new Promise((_, rej) => {
                timerId = setTimeout(() => rej(new Error("DNS timeout")), ms);
            });
            return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timerId));
        };
        try {
            const hostname = new URL(url).hostname;
            await raceWithTimeout(external_dns_namespaceObject.promises.lookup(hostname), timeout);
            return true;
        }
        catch (err) {
            if (retryOnce && err.code === "EAI_AGAIN") {
                try {
                    const hostname = new URL(url).hostname;
                    await raceWithTimeout(external_dns_namespaceObject.promises.lookup(hostname), timeout);
                    return true;
                }
                catch {
                    return false;
                }
            }
            return false;
        }
    }
    /**
     * Run heuristic search for a site and return first working pattern domain
     * Returns null if no pattern domain found
     */
    async runHeuristicSearch(siteName, siteIndex, site, failedUrl) {
        const heuristicTasks = this.generateCandidates(siteName, siteIndex, site, failedUrl);
        if (heuristicTasks.length === 0) {
            this.logger.debug(siteName, `No heuristic candidates generated`);
            return null;
        }
        const dnsCheckedTasks = await this.batchDnsCheck(heuristicTasks);
        const dnsOkTasks = dnsCheckedTasks.filter(t => t.dnsOk);
        if (dnsOkTasks.length === 0) {
            this.logger.debug(siteName, `No heuristic candidates passed DNS check`);
            return null;
        }
        return this.checkHeuristicCandidates(siteName, site, dnsOkTasks);
    }
    /**
     * Check heuristic candidates and return first working pattern domain
     * Returns null if no pattern domain found
     */
    async checkHeuristicCandidates(siteName, site, tasks) {
        // Check candidates sequentially until we find a working pattern domain
        for (const task of tasks) {
            this.logger.debug(siteName, `Heuristic checking candidate: ${task.candidateUrl}`);
            if (task.probeText && task.probeText.length > 0) {
                this.logger.debug(siteName, `Heuristic probe_text for ${task.candidateUrl}: ${JSON.stringify(task.probeText)}`);
            }
            else {
                this.logger.debug(siteName, `Heuristic: content probe is not configured for ${task.candidateUrl}`);
            }
            const httpResult = await this.resolver.resolve(task.candidateUrl, true, site, task.probeText);
            if (httpResult.success) {
                this.logger.debug(siteName, `Heuristic candidate ${task.candidateUrl}: HTTP ${httpResult.statusCode}${httpResult.antibotDetected ? ' (antibot)' : ''}`);
                // Content probe if needed
                let probeOk = true;
                if (task.probeText && task.probeText.length > 0) {
                    if (httpResult.antibotDetected && site.accept_antibot) {
                        this.logger.info(siteName, `Heuristic: content probe SKIPPED for antibot site (accept_antibot=true)`);
                        probeOk = true;
                    }
                    else {
                        probeOk = await this.probe.verify(task.probeText, httpResult.finalBody);
                        if (probeOk) {
                            this.logger.info(siteName, `Heuristic: content probe PASSED on ${task.candidateUrl}`);
                        }
                        else {
                            this.logger.info(siteName, `Heuristic: content probe FAILED on ${task.candidateUrl}, continuing search`);
                        }
                    }
                }
                if (probeOk === true) {
                    const heuristicNewHost = httpResult.finalHost.toLowerCase();
                    const heuristicIsPattern = this.matchesNumericPattern(heuristicNewHost);
                    if (heuristicIsPattern) {
                        // Found a pattern domain!
                        const chainFormatted = this.resolver.formatRedirectChain(httpResult.redirectChain);
                        this.logger.info(siteName, `Heuristic SUCCESS: ${task.candidateUrl}`);
                        this.logger.info(siteName, `Heuristic redirect chain: ${chainFormatted}`);
                        return {
                            newHost: heuristicNewHost,
                            result: httpResult,
                            candidateUrl: task.candidateUrl,
                        };
                    }
                    else {
                        // Heuristic found non-pattern domain, continue searching
                        this.logger.debug(siteName, `Heuristic found non-pattern domain: ${heuristicNewHost}, continuing search`);
                    }
                }
            }
        }
        return null; // No pattern domain found
    }
    /**
     * Generate heuristic candidates for a failed site
     */
    generateCandidates(siteName, siteIndex, site, failedUrl) {
        // Try pattern 1: domain[N].tld or domain[N][text].tld (number after letters)
        // Support optional www. prefix
        let match = failedUrl.match(/^(https?:\/\/)?(www\.)?([a-z-]+)(\d+)([a-z-]*)(\.[a-z.]+)(\/.*)?/i);
        let isNumberFirst = false;
        let wwwPrefix = '';
        // Try pattern 2: [N]domain.tld (number at the beginning)
        if (!match) {
            match = failedUrl.match(/^(https?:\/\/)?(www\.)?(\d+)([a-z-]+)(\.[a-z.]+)(\/.*)?/i);
            isNumberFirst = true;
        }
        if (!match) {
            this.logger.warn(siteName, "Heuristic: URL doesn't match domain[N].tld, domain[N][text].tld, or [N]domain.tld pattern, skipping");
            return [];
        }
        let protocol, prefix, numStr, middleText, suffix, path;
        if (isNumberFirst) {
            // Pattern: [N]domain.tld -> (protocol)(www.)(number)(letters)(suffix)(path)
            [, protocol = 'https://', wwwPrefix = '', numStr, prefix, suffix, path = ''] = match;
            middleText = '';
        }
        else {
            // Pattern: domain[N].tld or domain[N][text].tld -> (protocol)(www.)(letters)(number)(middle)(suffix)(path)
            [, protocol = 'https://', wwwPrefix = '', prefix, numStr, middleText = '', suffix, path = ''] = match;
        }
        const currentNum = parseInt(numStr, 10);
        const startNum = currentNum + 1;
        const tasks = [];
        for (let i = 0; i < this.config.heuristic.maxAttempts; i++) {
            const num = startNum + i;
            const candidateUrl = isNumberFirst
                ? `${protocol}${wwwPrefix}${num}${prefix}${suffix}${path}`
                : `${protocol}${wwwPrefix}${prefix}${num}${middleText}${suffix}${path}`;
            tasks.push({
                siteName,
                siteIndex,
                candidateUrl,
                attemptIndex: i,
                oldMirror: site.last_known_mirror,
                probeText: site.probe_text,
                site,
            });
        }
        return tasks;
    }
    /**
     * DNS pre-filter: check which candidates resolve
     */
    async batchDnsCheck(tasks) {
        const dnsConfig = this.config.dnsPreCheck;
        if (!dnsConfig.enabled) {
            // DNS pre-filter disabled, mark all as OK
            return tasks.map(t => ({ ...t, dnsOk: true }));
        }
        const dnsParallel = this.config.heuristic.dnsParallel ?? 20;
        const results = new Array(tasks.length);
        const activePromises = new Map();
        let nextIndex = 0;
        let completedCount = 0;
        try {
            // Rolling window with strict limit
            for (let i = 0; i < Math.min(dnsParallel, tasks.length); i++) {
                const idx = i;
                const promise = this.checkDnsResolution(tasks[idx].candidateUrl)
                    .then(ok => ({ index: idx, ok }))
                    .catch(err => {
                    // Catch unexpected errors to prevent unhandled rejections
                    this.logger.debug(tasks[idx].siteName, `DNS check failed with unexpected error: ${err.message}`);
                    return { index: idx, ok: false };
                });
                activePromises.set(idx, promise);
                nextIndex++;
            }
            while (completedCount < tasks.length) {
                try {
                    const completed = await Promise.race(activePromises.values());
                    activePromises.delete(completed.index);
                    results[completed.index] = { ...tasks[completed.index], dnsOk: completed.ok };
                    completedCount++;
                    // Log DNS result
                    const task = tasks[completed.index];
                    const dnsStatus = completed.ok ? 'OK' : 'FAILED';
                    this.logger.debug(task.siteName, `Heuristic DNS check: ${task.candidateUrl} - ${dnsStatus}`);
                    // Start next task if available
                    if (nextIndex < tasks.length) {
                        const idx = nextIndex;
                        const promise = this.checkDnsResolution(tasks[idx].candidateUrl)
                            .then(ok => ({ index: idx, ok }))
                            .catch(err => {
                            // Catch unexpected errors to prevent unhandled rejections
                            this.logger.debug(tasks[idx].siteName, `DNS check failed with unexpected error: ${err.message}`);
                            return { index: idx, ok: false };
                        });
                        activePromises.set(idx, promise);
                        nextIndex++;
                    }
                }
                catch (err) {
                    // Error in Promise.race - should not happen with proper error handling above
                    // but handle defensively to prevent loop hanging
                    this.logger.debug("", `Unexpected error in DNS check loop: ${err}`);
                    break;
                }
            }
        }
        finally {
            // Ensure activePromises is cleared even if an exception occurs
            activePromises.clear();
        }
        return results;
    }
    async processAll() {
        const siteEntries = Object.entries(this.watchers.sites);
        const results = new Array(siteEntries.length);
        // =============================
        // Phase 1: Resolve redirects only
        // =============================
        const resolveParallel = this.config.processing.resolveParallel ?? this.config.processing.parallel;
        const batchStart = Date.now();
        const enqueuedAt = new Array(siteEntries.length).fill(batchStart);
        const siteStartTimes = new Array(siteEntries.length).fill(0);
        const queuedDurations = [];
        const activePromises = new Map();
        let nextIndex = 0;
        const startResolveTask = (idx) => {
            const [name, site] = siteEntries[idx];
            siteStartTimes[idx] = Date.now();
            const queueMs = Date.now() - enqueuedAt[idx];
            queuedDurations.push(queueMs);
            const promise = this.processSite(name, site, queueMs)
                .then(result => ({ index: idx, result }));
            activePromises.set(idx, promise);
        };
        for (let i = 0; i < resolveParallel && i < siteEntries.length; i++) {
            startResolveTask(i);
            nextIndex = i + 1;
        }
        while (activePromises.size > 0) {
            const completed = await Promise.race(activePromises.values());
            activePromises.delete(completed.index);
            results[completed.index] = completed.result;
            if (nextIndex < siteEntries.length) {
                startResolveTask(nextIndex);
                nextIndex++;
            }
        }
        // =============================
        // Phase 2: Unified heuristic queue with DNS pre-filter
        // =============================
        if (this.config.heuristic.enabled) {
            // Step 1: Generate all candidates for failed sites
            const allTasks = [];
            for (let i = 0; i < siteEntries.length; i++) {
                const [name, site] = siteEntries[i];
                const r = results[i];
                if (!r)
                    continue;
                const failed = !r.result.success;
                const antibot = r.result.antibotDetected;
                const forceHeuristic = r.result.shouldTriggerHeuristic;
                const skipHeuristic = Boolean(site.disable_heuristic) || (antibot && this.config.heuristic.skipOnAntibot && !forceHeuristic);
                if ((failed || forceHeuristic || site.force_search_ahead) && !skipHeuristic) {
                    const failedUrl = site.initial_domain || site.last_known_mirror;
                    let candidates = this.generateCandidates(name, i, site, failedUrl);
                    // If initial_domain exists but doesn't match a numeric pattern (e.g. redirect shortener),
                    // fall back to last_known_mirror for candidate generation
                    if (candidates.length === 0 && site.initial_domain && site.last_known_mirror) {
                        this.logger.debug(name, `Heuristic: initial_domain "${site.initial_domain}" has no numeric pattern, falling back to last_known_mirror`);
                        candidates = this.generateCandidates(name, i, site, site.last_known_mirror);
                    }
                    allTasks.push(...candidates);
                }
                // Fallback: if site is working but on non-pattern domain, try history-based heuristic
                if (!failed && !skipHeuristic && site.heuristic_history && site.heuristic_history.length > 0) {
                    const currentToken = this.tokenizeDomain(site.last_known_mirror || '');
                    if (!currentToken.isPattern) {
                        // Group history by pattern for smarter fallback
                        const patternGroups = this.groupHistoryByPattern(site.heuristic_history);
                        if (patternGroups.size > 0) {
                            this.logger.info(name, `Current domain ${currentToken.hostname} is non-pattern, trying history-based heuristic`);
                            for (const [patternKey, domains] of patternGroups) {
                                this.logger.info(name, `Trying pattern ${patternKey} with ${domains.length} domains`);
                                // Check ALL domains in this pattern group from first to last
                                for (const historyDomain of domains) {
                                    // First, check the history domain itself
                                    const historyTask = {
                                        siteName: name,
                                        siteIndex: i,
                                        candidateUrl: historyDomain.startsWith('http') ? historyDomain : `https://${historyDomain}`,
                                        attemptIndex: -1, // Special marker for history domain
                                        oldMirror: site.last_known_mirror,
                                        probeText: site.probe_text,
                                        site,
                                    };
                                    allTasks.push(historyTask);
                                    // Then generate new candidates from the history domain
                                    const candidates = this.generateCandidates(name, i, site, historyDomain);
                                    allTasks.push(...candidates);
                                }
                            }
                        }
                    }
                }
            }
            if (allTasks.length > 0) {
                // Step 2: DNS pre-filter
                const dnsChecked = await this.batchDnsCheck(allTasks);
                const dnsOkTasks = dnsChecked.filter(t => t.dnsOk);
                // Step 3: HTTP checks with unified queue
                const heuristicParallel = this.config.processing.heuristicParallel ?? this.config.processing.parallel;
                const foundSites = new Set();
                const foundDomainsPerSite = new Map();
                // Pre-populate foundSites and foundDomainsPerSite with successful Phase 1 results for force_search_ahead sites
                // This ensures Phase 2 doesn't overwrite Phase 1 results, only collects additional domains
                for (let i = 0; i < siteEntries.length; i++) {
                    const [name, site] = siteEntries[i];
                    const r = results[i];
                    if (r && r.result.success && site.force_search_ahead) {
                        foundSites.add(i);
                        foundDomainsPerSite.set(i, [{
                                domain: r.newHost, // final working domain after redirects
                                result: r.result,
                                candidateUrl: r.startedHost,
                            }]);
                        this.logger.info(name, `force_search_ahead: Phase 1 working domain ${r.newHost} collected`);
                    }
                }
                const activePromises = new Map();
                let nextTaskIndex = 0;
                const checkCandidate = async (task) => {
                    this.logger.debug(task.siteName, `Heuristic checking candidate: ${task.candidateUrl}`);
                    if (task.probeText && task.probeText.length > 0) {
                        this.logger.debug(task.siteName, `Heuristic probe_text for ${task.candidateUrl}: ${JSON.stringify(task.probeText)}`);
                    }
                    else {
                        this.logger.debug(task.siteName, `Heuristic: content probe not configured for ${task.candidateUrl}`);
                    }
                    const httpResult = await this.resolver.resolve(task.candidateUrl, true, task.site, task.probeText);
                    return httpResult;
                };
                // Start initial window with early site-found check
                while (activePromises.size < heuristicParallel && nextTaskIndex < dnsOkTasks.length) {
                    // Skip tasks for sites that are already found (unless force_search_ahead is enabled)
                    while (nextTaskIndex < dnsOkTasks.length) {
                        const currentTask = dnsOkTasks[nextTaskIndex];
                        if (foundSites.has(currentTask.siteIndex) && !currentTask.site.force_search_ahead) {
                            nextTaskIndex++;
                        }
                        else {
                            break;
                        }
                    }
                    if (nextTaskIndex >= dnsOkTasks.length)
                        break;
                    const task = dnsOkTasks[nextTaskIndex];
                    const idx = nextTaskIndex; // capture immutable index for this promise
                    const promise = checkCandidate(task).then(result => ({ taskIndex: idx, task, result }));
                    activePromises.set(idx, promise);
                    nextTaskIndex++;
                }
                // Process results
                let checksCompleted = 0;
                while (activePromises.size > 0) {
                    const completed = await Promise.race(activePromises.values());
                    activePromises.delete(completed.taskIndex);
                    checksCompleted++;
                    const { task, result } = completed;
                    // Atomic check-and-process: handle force_search_ahead differently
                    const alreadyFound = foundSites.has(task.siteIndex);
                    const continueSearch = task.site.force_search_ahead;
                    if (alreadyFound && !continueSearch) {
                        // Site already found and not force_search_ahead, skip processing
                        this.logger.debug(task.siteName, `Heuristic: skipping ${task.candidateUrl} (site already found)`);
                    }
                    else if (result.success) {
                        this.logger.debug(task.siteName, `Heuristic candidate ${task.candidateUrl}: HTTP ${result.statusCode}${result.antibotDetected ? ' (antibot)' : ''}`);
                        // Content probe if needed (skip for antibot sites when accept_antibot is true)
                        let probeOk = true;
                        if (task.probeText && task.probeText.length > 0) {
                            // Skip probe for antibot sites that accept antibot
                            if (result.antibotDetected && task.site.accept_antibot) {
                                this.logger.info(task.siteName, `Heuristic: content probe SKIPPED for antibot site (accept_antibot=true)`);
                                probeOk = true;
                            }
                            else {
                                probeOk = await this.probe.verify(task.probeText, result.finalBody);
                                if (probeOk) {
                                    this.logger.info(task.siteName, `Heuristic: content probe PASSED on ${task.candidateUrl}`);
                                }
                                else {
                                    this.logger.info(task.siteName, `Heuristic: content probe FAILED on ${task.candidateUrl}, continuing search`);
                                }
                            }
                        }
                        if (probeOk) {
                            const oldHost = this.resolver.extractHostWithoutQuery(task.oldMirror);
                            const newHost = result.finalHost.toLowerCase();
                            const chainFormatted = this.resolver.formatRedirectChain(result.redirectChain);
                            this.logger.info(task.siteName, `Heuristic SUCCESS: ${task.candidateUrl}`);
                            this.logger.info(task.siteName, `Heuristic redirect chain: ${chainFormatted}`);
                            // If force_search_ahead, collect the final working domain
                            // The finalHost is the domain that returned 200 OK, which is what we want
                            if (task.site.force_search_ahead) {
                                if (!foundDomainsPerSite.has(task.siteIndex)) {
                                    foundDomainsPerSite.set(task.siteIndex, []);
                                }
                                foundDomainsPerSite.get(task.siteIndex).push({
                                    domain: newHost,
                                    result,
                                    candidateUrl: task.candidateUrl,
                                });
                                this.logger.info(task.siteName, `force_search_ahead: collected working final domain ${newHost} from ${task.candidateUrl}`);
                            }
                            // Mark site as found (first success or non-force_search_ahead)
                            if (!foundSites.has(task.siteIndex)) {
                                foundSites.add(task.siteIndex);
                                // Normalize URL before extracting host for heuristic success
                                const heuristicStartUrl = task.site.initial_domain || task.site.last_known_mirror;
                                const heuristicNormalized = heuristicStartUrl.startsWith("http://") || heuristicStartUrl.startsWith("https://")
                                    ? heuristicStartUrl
                                    : `https://${heuristicStartUrl}`;
                                const siteDuration = Date.now() - siteStartTimes[task.siteIndex];
                                // Save old last_known_mirror BEFORE any mutation for history comparison
                                const oldLastKnownMirror = task.site.last_known_mirror;
                                // Update domain history now (we have the correct old value)
                                this.updateDomainHistory(task.site, newHost, oldLastKnownMirror);
                                // If new domain is non-pattern, do NOT update filters:
                                // the old pattern domain stays in the filter until we find a new pattern domain.
                                // We only record history and flags so next run can use heuristic_history.
                                const newHostIsPattern = this.matchesNumericPattern(newHost);
                                results[task.siteIndex] = {
                                    siteName: task.siteName,
                                    oldHost,
                                    newHost,
                                    hostChanged: newHostIsPattern, // only treat as changed when new domain is pattern
                                    startedHost: this.resolver.extractHostWithoutQuery(heuristicNormalized),
                                    result,
                                    shouldUpdate: newHostIsPattern,
                                    checkDurationMs: siteDuration,
                                    actualCheckedDomain: task.candidateUrl,
                                    additionalWorkingDomains: [], // Will be populated later if force_search_ahead
                                    historyUpdated: true, // already called updateDomainHistory above
                                };
                            }
                        }
                    }
                    else if (result.skippedByText) {
                        // Domain matched skip_text (parked/expired) — skip candidate, continue search
                        this.logger.debug(task.siteName, `Heuristic: ${task.candidateUrl} skipped by skip_text: "${result.skippedByText}"`);
                    }
                    else {
                        // HTTP request failed - log the failure
                        const statusInfo = result.statusCode ? `HTTP ${result.statusCode}` : 'connection failed';
                        this.logger.debug(task.siteName, `Heuristic candidate ${task.candidateUrl}: ${statusInfo} - ${result.error || 'unknown error'}`);
                    }
                    if (result.antibotDetected && this.config.heuristic.skipOnAntibot && !task.site.accept_antibot) {
                        // Antibot detected and site doesn't accept antibot, mark as found to stop further checks
                        foundSites.add(task.siteIndex);
                        this.logger.warn(task.siteName, `Heuristic: antibot detected on ${task.candidateUrl}, stopping search for this site`);
                        // Create a result entry with the actual domain that had antibot
                        const oldHost = task.site.last_known_mirror ? this.resolver.normalizeAndExtractHost(task.site.last_known_mirror) : "";
                        const siteDuration = Date.now() - siteStartTimes[task.siteIndex];
                        results[task.siteIndex] = {
                            siteName: task.siteName,
                            oldHost,
                            newHost: result.finalHost,
                            hostChanged: false,
                            startedHost: task.site.last_known_mirror ? this.resolver.extractHostWithoutQuery(task.site.last_known_mirror) : "",
                            result,
                            shouldUpdate: false,
                            error: result.error,
                            checkDurationMs: siteDuration,
                            actualCheckedDomain: task.candidateUrl,
                        };
                    }
                    else if (result.antibotDetected && task.site.accept_antibot) {
                        // Antibot detected but site accepts antibot, treat as success
                        foundSites.add(task.siteIndex);
                        const oldHost = this.resolver.extractHostWithoutQuery(task.oldMirror);
                        const newHost = result.finalHost.toLowerCase();
                        const chainFormatted = this.resolver.formatRedirectChain(result.redirectChain);
                        this.logger.info(task.siteName, `Heuristic SUCCESS (antibot accepted): ${task.candidateUrl}`);
                        this.logger.info(task.siteName, `Heuristic redirect chain: ${chainFormatted}`);
                        // Normalize URL before extracting host for heuristic success
                        const heuristicStartUrl = task.site.initial_domain || task.site.last_known_mirror;
                        const heuristicNormalized = heuristicStartUrl.startsWith("http://") || heuristicStartUrl.startsWith("https://")
                            ? heuristicStartUrl
                            : `https://${heuristicStartUrl}`;
                        const siteDuration = Date.now() - siteStartTimes[task.siteIndex];
                        // Save old last_known_mirror BEFORE any mutation for history comparison
                        const oldLastKnownMirrorAntibot = task.site.last_known_mirror;
                        // Update domain history now (we have the correct old value)
                        this.updateDomainHistory(task.site, newHost, oldLastKnownMirrorAntibot);
                        // If new domain is non-pattern, do NOT update filters
                        const newHostIsPatternAntibot = this.matchesNumericPattern(newHost);
                        results[task.siteIndex] = {
                            siteName: task.siteName,
                            oldHost,
                            newHost,
                            hostChanged: newHostIsPatternAntibot,
                            startedHost: this.resolver.extractHostWithoutQuery(heuristicNormalized),
                            result,
                            shouldUpdate: newHostIsPatternAntibot,
                            checkDurationMs: siteDuration,
                            actualCheckedDomain: task.candidateUrl,
                            historyUpdated: true, // already called updateDomainHistory above
                        };
                    }
                    // Start next task if available and below parallel limit
                    while (nextTaskIndex < dnsOkTasks.length && activePromises.size < heuristicParallel) {
                        // Skip tasks for sites that are already found (unless force_search_ahead is enabled)
                        while (nextTaskIndex < dnsOkTasks.length) {
                            const currentTask = dnsOkTasks[nextTaskIndex];
                            if (foundSites.has(currentTask.siteIndex) && !currentTask.site.force_search_ahead) {
                                nextTaskIndex++;
                            }
                            else {
                                break;
                            }
                        }
                        if (nextTaskIndex >= dnsOkTasks.length)
                            break;
                        const nextTask = dnsOkTasks[nextTaskIndex];
                        const idx = nextTaskIndex; // capture immutable index
                        const promise = checkCandidate(nextTask).then(result => ({ taskIndex: idx, task: nextTask, result }));
                        activePromises.set(idx, promise);
                        nextTaskIndex++;
                    }
                }
                // Populate additionalWorkingDomains for force_search_ahead sites
                if (foundDomainsPerSite.size > 0) {
                    for (const [siteIndex, domains] of foundDomainsPerSite.entries()) {
                        const siteName = siteEntries[siteIndex][0];
                        if (results[siteIndex] && domains.length > 1) {
                            // Extract domain names excluding the first one (which is already in newHost)
                            const firstDomain = results[siteIndex].newHost;
                            results[siteIndex].additionalWorkingDomains = domains
                                .map((d) => d.domain)
                                .filter(domain => domain !== firstDomain);
                            this.logger.info(siteName, `force_search_ahead: collected ${domains.length} working domains: ${domains.map((d) => d.domain).join(', ')}`);
                        }
                    }
                }
            }
        }
        // Log completion of batch phase
        this.logger.logGlobal(LogLevel.INFO, "=== Domain checks finished ===\n");
        return results.filter(Boolean);
    }
    async processSite(siteName, site, queuedMs = 0) {
        const siteStartTime = Date.now();
        if (queuedMs > 0) {
            this.logger.debug(siteName, `Queued for ${queuedMs}ms before start`);
        }
        // Log geoblock if present
        if (site.geoblock) {
            this.logger.warn(siteName, `Geo-blocking: ${site.geoblock}`);
        }
        this.logger.info(siteName, "Starting check...");
        // Optimization: if last_seen is recent (< 2 days), try last_known_mirror first
        let urlToCheck;
        if (site.last_seen) {
            const daysSinceLastSeen = this.calculateDaysSince(site.last_seen);
            if (daysSinceLastSeen < 2 && site.last_known_mirror) {
                // Recent success - try last_known_mirror first
                urlToCheck = site.last_known_mirror;
                this.logger.debug(siteName, `Recent success (${daysSinceLastSeen} days ago), trying last_known_mirror first`);
            }
        }
        if (!urlToCheck) {
            // Standard path: initial_domain -> last_known_mirror
            urlToCheck = site.initial_domain || site.last_known_mirror;
        }
        if (!urlToCheck) {
            this.logger.error(siteName, "No URL to check (missing initial_domain and last_known_mirror)");
            const siteDuration = Date.now() - siteStartTime;
            this.logger.debug(siteName, `Check completed in ${siteDuration}ms - NO URL CONFIGURED`);
            return {
                siteName,
                oldHost: "",
                newHost: "",
                hostChanged: false,
                startedHost: "",
                result: {
                    success: false,
                    finalUrl: "",
                    finalHost: "",
                    statusCode: 0,
                    redirectChain: [],
                    error: "No URL configured",
                },
                shouldUpdate: false,
                error: "No URL configured",
                checkDurationMs: siteDuration,
                actualCheckedDomain: "",
            };
        }
        this.logger.debug(siteName, `Checking: ${urlToCheck}`);
        // Normalize URL before extracting host (add https:// if missing)
        if (typeof urlToCheck !== 'string') {
            this.logger.error(siteName, `Invalid URL type: ${typeof urlToCheck}, value: ${urlToCheck}`);
            const siteDuration = Date.now() - siteStartTime;
            return {
                siteName,
                oldHost: "",
                newHost: "",
                hostChanged: false,
                startedHost: "",
                result: {
                    success: false,
                    finalUrl: "",
                    finalHost: "",
                    statusCode: 0,
                    redirectChain: [],
                    error: `Invalid URL type: ${typeof urlToCheck}`,
                },
                shouldUpdate: false,
                checkDurationMs: siteDuration,
                actualCheckedDomain: "",
            };
        }
        const normalizedUrl = urlToCheck.startsWith("http://") || urlToCheck.startsWith("https://")
            ? urlToCheck
            : `https://${urlToCheck}`;
        const startedHost = this.resolver.extractHostWithoutQuery(normalizedUrl);
        // DNS pre-check: skip HTTP request if domain doesn't resolve
        const dnsCheckStart = Date.now();
        const dnsResolves = await this.checkDnsResolution(normalizedUrl);
        const dnsCheckDuration = Date.now() - dnsCheckStart;
        if (!dnsResolves) {
            this.logger.warn(siteName, `DNS resolution failed (${dnsCheckDuration}ms) - skipping HTTP request`);
            const siteDuration = Date.now() - siteStartTime;
            this.logger.debug(siteName, `Check completed in ${siteDuration}ms (dns: ${dnsCheckDuration}ms) - DNS FAILED`);
            return {
                siteName,
                oldHost: site.last_known_mirror ? this.resolver.normalizeAndExtractHost(site.last_known_mirror) : "",
                newHost: "",
                hostChanged: false,
                startedHost: this.resolver.extractHostWithoutQuery(normalizedUrl),
                result: {
                    success: false,
                    finalUrl: normalizedUrl,
                    finalHost: "",
                    statusCode: 0,
                    redirectChain: [],
                    error: "DNS resolution failed",
                    shouldTriggerHeuristic: true, // Trigger heuristic for DNS failures
                },
                shouldUpdate: false,
                error: "DNS resolution failed",
                checkDurationMs: siteDuration,
                actualCheckedDomain: normalizedUrl,
            };
        }
        this.logger.debug(siteName, `DNS OK (${dnsCheckDuration}ms)`);
        // Resolve redirects
        const resolveStartTime = Date.now();
        const result = await this.resolver.resolve(urlToCheck, false, site, site.probe_text);
        const resolveDuration = Date.now() - resolveStartTime;
        const chainFormatted = this.resolver.formatRedirectChain(result.redirectChain);
        this.logger.debug(siteName, `Redirect chain: ${chainFormatted}`);
        if (!result.success) {
            if (result.antibotDetected) {
                this.logger.warn(siteName, result.error || "Antibot/Cloudflare detected");
            }
            else {
                this.logger.error(siteName, result.error || "Check failed");
            }
            // Heuristic is now handled in Phase 2 (unified queue)
            const siteDuration = Date.now() - siteStartTime;
            this.logger.debug(siteName, `Check completed in ${siteDuration}ms (resolve: ${resolveDuration}ms) - FAILED`);
            return {
                siteName,
                oldHost: site.last_known_mirror ? this.resolver.normalizeAndExtractHost(site.last_known_mirror) : "",
                newHost: result.finalHost,
                hostChanged: false,
                startedHost,
                result,
                shouldUpdate: false,
                error: result.error,
                checkDurationMs: siteDuration,
                // Store the actual domain that was checked for accurate error reporting
                actualCheckedDomain: result.finalUrl || urlToCheck,
            };
        }
        // Special handling for accept_antibot sites
        if (result.antibotDetected && site.accept_antibot) {
            this.logger.warn(siteName, "Antibot accepted (accept_antibot=true)");
        }
        // Content probe (if configured)
        if (site.probe_text && site.probe_text.length > 0) {
            // Skip probe for antibot responses when accept_antibot is true
            // (Cloudflare challenge page won't contain probe_text, but the site is still considered working)
            if (result.antibotDetected && site.accept_antibot) {
                this.logger.info(siteName, `Content probe SKIPPED for antibot site (accept_antibot=true)`);
            }
            else {
                const probeOk = await this.probe.verify(site.probe_text, result.finalBody);
                result.contentProbeOk = probeOk;
                if (probeOk) {
                    this.logger.info(siteName, `Content probe PASSED on ${result.finalUrl || urlToCheck}`);
                }
                else {
                    this.logger.info(siteName, `Content probe FAILED on ${result.finalUrl || urlToCheck}`);
                }
                if (!probeOk) {
                    const siteDuration = Date.now() - siteStartTime;
                    this.logger.debug(siteName, `Check completed in ${siteDuration}ms (resolve: ${resolveDuration}ms) - PROBE FAILED`);
                    // Mark result as failed to trigger heuristic search
                    result.success = false;
                    result.error = "Content probe failed";
                    return {
                        siteName,
                        oldHost: site.last_known_mirror ? this.resolver.normalizeAndExtractHost(site.last_known_mirror) : "",
                        newHost: result.finalHost,
                        hostChanged: false,
                        startedHost,
                        result,
                        shouldUpdate: false,
                        error: "Content probe failed",
                        checkDurationMs: siteDuration,
                        actualCheckedDomain: result.finalUrl || urlToCheck,
                    };
                }
            }
        }
        // Check if host changed
        const oldHost = site.last_known_mirror ? this.resolver.normalizeAndExtractHost(site.last_known_mirror) : "";
        const newHost = result.finalHost.toLowerCase();
        // hostChanged: compare where we started (startedHost) with where we ended up (newHost)
        // This correctly detects changes even when last_known_mirror already matches the result
        const hostChanged = startedHost !== newHost;
        // Check path if specified
        if (site.path) {
            const finalPath = this.resolver.extractPathWithoutQuery(result.finalUrl);
            if (finalPath !== site.path) {
                this.logger.warn(siteName, `Path mismatch: expected ${site.path}, got ${finalPath} - manual review needed`);
                const siteDuration = Date.now() - siteStartTime;
                this.logger.debug(siteName, `Check completed in ${siteDuration}ms (resolve: ${resolveDuration}ms) - PATH MISMATCH`);
                return {
                    siteName,
                    oldHost,
                    newHost,
                    hostChanged: false,
                    startedHost,
                    result,
                    shouldUpdate: false,
                    error: "Path changed - manual review required",
                    checkDurationMs: siteDuration,
                    actualCheckedDomain: result.finalUrl || urlToCheck,
                };
            }
        }
        // Log the change using startedHost for clarity
        if (hostChanged) {
            this.logger.info(siteName, `Host changed: ${startedHost} => ${newHost}`);
        }
        else {
            this.logger.info(siteName, `Host unchanged: ${newHost}`);
        }
        const siteDuration = Date.now() - siteStartTime;
        this.logger.debug(siteName, `Check completed in ${siteDuration}ms (resolve: ${resolveDuration}ms)`);
        // shouldUpdate: process filters if domain changed OR if we need to clean up predicted mirrors
        // (to clean up predicted mirrors even when last_known_mirror didn't change)
        const hasNumericPatterns = /\d+/.test(newHost);
        const hasWildcardInSiteName = siteName.includes('*');
        // If old domain was pattern and new domain is non-pattern: do NOT update filters.
        // Record history/flags and let index.ts update last_known_mirror only.
        const oldHostIsPattern = this.matchesNumericPattern(oldHost);
        const newHostIsPattern = this.matchesNumericPattern(newHost);
        const isPatternToNonPattern = hostChanged && oldHostIsPattern && !newHostIsPattern;
        let shouldUpdate = hostChanged || (!!startedHost && hasNumericPatterns) || hasWildcardInSiteName;
        let historyUpdated = false;
        if (isPatternToNonPattern) {
            // Pattern → Non-pattern detected: save history and try heuristic immediately
            this.logger.warn(siteName, `Pattern domain redirected to non-pattern (${oldHost} → ${newHost})`);
            this.updateDomainHistory(site, newHost, site.last_known_mirror);
            historyUpdated = true;
            shouldUpdate = false; // do not touch filter files yet
            // Try heuristic search immediately to find a new pattern domain
            this.logger.info(siteName, `Triggering heuristic search to find new pattern domain...`);
            const heuristicResult = await this.runHeuristicSearch(siteName, 0, site, oldHost);
            if (heuristicResult) {
                // Found a pattern domain via heuristic!
                this.logger.info(siteName, `Heuristic found new pattern domain: ${heuristicResult.newHost}`);
                // Update history: clear flags since we're back on pattern
                this.updateDomainHistory(site, heuristicResult.newHost, oldHost);
                // Return heuristic result instead
                return {
                    siteName,
                    oldHost,
                    newHost: heuristicResult.newHost,
                    hostChanged: true,
                    startedHost,
                    result: heuristicResult.result,
                    shouldUpdate: true, // Update filters with new pattern domain
                    checkDurationMs: Date.now() - siteStartTime,
                    actualCheckedDomain: heuristicResult.result.finalUrl || heuristicResult.candidateUrl,
                    historyUpdated: true,
                };
            }
            else {
                this.logger.info(siteName, `Heuristic search found no working pattern domains`);
            }
        }
        return {
            siteName,
            oldHost,
            newHost,
            hostChanged,
            startedHost,
            result,
            shouldUpdate,
            checkDurationMs: siteDuration,
            actualCheckedDomain: result.finalUrl || urlToCheck,
            historyUpdated,
        };
    }
}

;// CONCATENATED MODULE: ./src/httpResolver.ts
class HttpResolver {
    config;
    activeAbortControllers = new Set();
    constructor(config) {
        this.config = config;
    }
    /**
     * Force abort all active requests
     */
    abortAllRequests() {
        for (const controller of this.activeAbortControllers) {
            try {
                controller.abort();
            }
            catch (e) {
                // Ignore errors during abort
            }
        }
        this.activeAbortControllers.clear();
    }
    /**
     * Normalize URL by adding https:// if no protocol specified
     */
    normalizeUrl(url) {
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            return `https://${url}`;
        }
        return url;
    }
    async resolve(url, useHeuristicTimeout = false, site, probeText) {
        const chain = [];
        let currentUrl = this.normalizeUrl(url);
        let depth = 0;
        try {
            while (depth <= this.config.processing.redirectDepth) {
                let response;
                try {
                    response = await this.fetchWithRetry(currentUrl, useHeuristicTimeout);
                    // Add successful request to chain
                    chain.push({
                        url: currentUrl,
                        statusCode: response.status,
                        location: response.headers.get("location") || undefined,
                    });
                }
                catch (err) {
                    // Add failed request to chain before throwing
                    chain.push({
                        url: currentUrl,
                        statusCode: 0,
                        location: undefined,
                    });
                    throw err;
                }
                // Check for antibot
                if (this.isAntibotResponse(response, currentUrl)) {
                    // If site accepts antibot responses, treat as success
                    if (site?.accept_antibot) {
                        // Capture body for content probing even with antibot
                        let finalBody;
                        try {
                            const contentType = response.headers.get("content-type") || "";
                            if (contentType.includes("text/html") || contentType.includes("text/plain")) {
                                finalBody = await response.text();
                            }
                            else {
                                await response.arrayBuffer();
                            }
                        }
                        catch { }
                        // When force_search_ahead is enabled, signal heuristic to collect more domains
                        const shouldTriggerHeuristic = Boolean(site.force_search_ahead) || this.config.heuristic.forceHeuristicOnCodes.includes(response.status);
                        return {
                            success: true,
                            finalUrl: currentUrl,
                            finalHost: new URL(currentUrl).hostname,
                            statusCode: response.status,
                            redirectChain: chain,
                            antibotDetected: true, // Keep flag for logging
                            finalBody,
                            shouldTriggerHeuristic,
                        };
                    }
                    // Consume body to release connection - must not throw
                    try {
                        await response.arrayBuffer();
                    }
                    catch { }
                    return {
                        success: false,
                        finalUrl: currentUrl,
                        finalHost: new URL(currentUrl).hostname,
                        statusCode: response.status,
                        redirectChain: chain,
                        antibotDetected: true,
                        error: `Antibot detected: ${response.status} or __cf_chl_tk in URL`,
                    };
                }
                // Success case
                if (response.status >= 200 && response.status < 300) {
                    // Capture body for content probing (text/html only)
                    let finalBody;
                    try {
                        const contentType = response.headers.get("content-type") || "";
                        if (contentType.includes("text/html") || contentType.includes("text/plain")) {
                            finalBody = await response.text();
                        }
                        else {
                            // Non-text content, just consume to release connection
                            await response.arrayBuffer();
                        }
                    }
                    catch {
                        // If body read fails, continue without it
                    }
                    // First check probe_text if provided - this helps distinguish working sites from landing pages
                    // that might share skip_text patterns (e.g., "patronmarketing" appears on both)
                    let hasProbeText = false;
                    if (probeText && probeText.length > 0 && finalBody) {
                        hasProbeText = probeText.every(text => finalBody.includes(text));
                    }
                    // Then check global skip_text — detect parked/expired domains
                    // Skip only if probe_text is NOT present (to avoid false positives)
                    const skipPhrase = this.containsSkipText(finalBody);
                    if (skipPhrase && !hasProbeText) {
                        return {
                            success: false,
                            finalUrl: currentUrl,
                            finalHost: new URL(currentUrl).hostname,
                            statusCode: response.status,
                            redirectChain: chain,
                            antibotDetected: false,
                            finalBody,
                            skippedByText: skipPhrase,
                            error: `Skipped by skip_text: "${skipPhrase}"`,
                            shouldTriggerHeuristic: true,
                        };
                    }
                    // Check for JS / meta-refresh redirects in body
                    const jsRedirectUrl = this.extractJsRedirect(finalBody, currentUrl);
                    if (jsRedirectUrl) {
                        // Update the already-pushed chain entry with the JS redirect location
                        chain[chain.length - 1].location = jsRedirectUrl;
                        currentUrl = jsRedirectUrl;
                        depth++;
                        if (depth > this.config.processing.redirectDepth) {
                            return {
                                success: false,
                                finalUrl: currentUrl,
                                finalHost: new URL(currentUrl).hostname,
                                statusCode: response.status,
                                redirectChain: chain,
                                error: `Exceeded max redirect depth (${this.config.processing.redirectDepth})`,
                            };
                        }
                        continue;
                    }
                    return {
                        success: true,
                        finalUrl: currentUrl,
                        finalHost: new URL(currentUrl).hostname,
                        statusCode: response.status,
                        redirectChain: chain,
                        antibotDetected: false,
                        finalBody,
                    };
                }
                // Redirect case
                if (response.status >= 300 && response.status < 400) {
                    const location = response.headers.get("location");
                    // Consume body to release connection (redirects typically have empty/small body) - must not throw
                    try {
                        await response.arrayBuffer();
                    }
                    catch { }
                    if (!location) {
                        return {
                            success: false,
                            finalUrl: currentUrl,
                            finalHost: new URL(currentUrl).hostname,
                            statusCode: response.status,
                            redirectChain: chain,
                            error: `Redirect ${response.status} without Location header`,
                        };
                    }
                    // Resolve relative URLs
                    currentUrl = new URL(location, currentUrl).href;
                    depth++;
                    if (depth > this.config.processing.redirectDepth) {
                        return {
                            success: false,
                            finalUrl: currentUrl,
                            finalHost: new URL(currentUrl).hostname,
                            statusCode: response.status,
                            redirectChain: chain,
                            error: `Exceeded max redirect depth (${this.config.processing.redirectDepth})`,
                        };
                    }
                    continue;
                }
                // Other error status
                // Consume body to release connection - must not throw
                try {
                    await response.arrayBuffer();
                }
                catch { }
                // Check if this status code should trigger heuristic
                const shouldTriggerHeuristic = this.config.heuristic.forceHeuristicOnCodes.includes(response.status);
                return {
                    success: false,
                    finalUrl: currentUrl,
                    finalHost: new URL(currentUrl).hostname,
                    statusCode: response.status,
                    redirectChain: chain,
                    error: `Non-success status: ${response.status}`,
                    shouldTriggerHeuristic,
                };
            }
            return {
                success: false,
                finalUrl: currentUrl,
                finalHost: new URL(currentUrl).hostname,
                statusCode: 0,
                redirectChain: chain,
                error: "Unexpected loop exit",
            };
        }
        catch (err) {
            // Check if this error should trigger heuristic (timeouts, connection issues)
            const errorMessage = err instanceof Error ? err.message.toLowerCase() : "";
            const shouldTriggerHeuristic = errorMessage.includes("timeout") ||
                errorMessage.includes("aborted") ||
                errorMessage.includes("connection") ||
                errorMessage.includes("network");
            return {
                success: false,
                finalUrl: currentUrl,
                finalHost: "",
                statusCode: 0,
                redirectChain: chain,
                error: err instanceof Error ? err.message : String(err),
                shouldTriggerHeuristic,
            };
        }
    }
    async fetchWithRetry(url, useHeuristicTimeout = false) {
        let lastError = null;
        const timeout = useHeuristicTimeout
            ? this.config.http.heuristicTimeout
            : (this.config.http.resolveTimeout ?? this.config.http.timeout);
        for (let attempt = 0; attempt < this.config.http.retries; attempt++) {
            const abortController = new AbortController();
            const timeoutSignal = AbortSignal.timeout(timeout);
            // Combine manual abort and timeout signals
            const combinedSignal = AbortSignal.any([abortController.signal, timeoutSignal]);
            this.activeAbortControllers.add(abortController);
            try {
                const response = await fetch(url, {
                    method: "GET",
                    headers: {
                        "User-Agent": this.config.http.userAgent,
                        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                        "Accept-Language": "en-US,en;q=0.9",
                        "Connection": "keep-alive",
                        "Accept-Encoding": "gzip, deflate, br",
                    },
                    redirect: "manual",
                    signal: combinedSignal,
                });
                // Remove from active set when successful
                this.activeAbortControllers.delete(abortController);
                return response;
            }
            catch (err) {
                // Remove from active set even on error
                this.activeAbortControllers.delete(abortController);
                lastError = err instanceof Error ? err : new Error(String(err));
                // Extract deeper details (undici often throws Error('fetch failed') with cause)
                const rawErr = err;
                const cause = rawErr && typeof rawErr === 'object' ? (rawErr.cause ?? undefined) : undefined;
                const rawCode = rawErr?.code ?? cause?.code;
                const code = typeof rawCode === 'string' ? rawCode : (typeof rawCode === 'number' ? String(rawCode) : undefined);
                const syscall = rawErr?.syscall ?? cause?.syscall;
                const address = rawErr?.address ?? cause?.address;
                const port = rawErr?.port ?? cause?.port;
                // Classify error type
                const errorMessage = (lastError.message || "").toLowerCase();
                let errorType = "Network error";
                let shouldRetry = true;
                // Prefer code-based classification when available
                switch ((code || '').toUpperCase()) {
                    case 'ETIMEDOUT':
                        errorType = "Connection timeout";
                        shouldRetry = true;
                        break;
                    case 'ECONNRESET':
                        errorType = "Connection reset";
                        shouldRetry = true;
                        break;
                    case 'ECONNREFUSED':
                        errorType = "Connection refused";
                        shouldRetry = false;
                        break;
                    case 'ENOTFOUND':
                    case 'EAI_AGAIN':
                    case 'EAI_FAIL':
                        errorType = "DNS resolution failed";
                        shouldRetry = false;
                        break;
                    case 'EPROTO':
                    case 'ERR_SSL_PROTOCOL_ERROR':
                        errorType = "TLS/SSL protocol error";
                        shouldRetry = false;
                        break;
                    default: {
                        // Fallback to message-based
                        if (errorMessage.includes("aborted") || errorMessage.includes("abort")) {
                            errorType = `Timeout (${timeout}ms)`;
                            shouldRetry = true; // Retry timeouts (pool contention may cause the first to fail)
                        }
                        else if (errorMessage.includes("enotfound") || errorMessage.includes("getaddrinfo")) {
                            errorType = "DNS resolution failed";
                            shouldRetry = false;
                        }
                        else if (errorMessage.includes("econnrefused")) {
                            errorType = "Connection refused";
                            shouldRetry = false;
                        }
                        else if (errorMessage.includes("econnreset")) {
                            errorType = "Connection reset";
                            shouldRetry = true;
                        }
                        else if (errorMessage.includes("etimedout")) {
                            errorType = "Connection timeout";
                            shouldRetry = true;
                        }
                    }
                }
                // Append low-level details if available
                const details = [];
                if (code)
                    details.push(`code=${code}`);
                if (syscall)
                    details.push(`syscall=${syscall}`);
                if (address)
                    details.push(`addr=${address}${port ? ':' + port : ''}`);
                const suffix = details.length ? ` [${details.join(', ')}]` : '';
                // Update error message with type and details
                lastError = new Error(`${errorType}${suffix}: ${lastError.message}`);
                // Only retry if it makes sense
                if (!shouldRetry) {
                    throw lastError;
                }
                if (attempt < this.config.http.retries - 1) {
                    // Exponential backoff
                    await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                }
            }
        }
        throw lastError || new Error("Fetch failed after retries");
    }
    /**
     * Extract redirect URL from JS redirects and meta refresh tags in HTML body.
     * Handles: location.replace(), window.location.href=, location.href=, meta http-equiv="refresh"
     * @returns Absolute redirect URL, or undefined if none found
     */
    extractJsRedirect(body, baseUrl) {
        if (!body)
            return undefined;
        // meta refresh: <meta http-equiv="refresh" content="0;URL=https://...">
        const metaMatch = body.match(/<meta[^>]+http-equiv=["']?refresh["']?[^>]+content=["'][^"']*(?:url=|URL=)([^"'\s>]+)/i)
            ?? body.match(/<meta[^>]+content=["'][^"']*(?:url=|URL=)([^"'\s>]+)[^"']*["'][^>]+http-equiv=["']?refresh["']?/i);
        if (metaMatch) {
            try {
                return new URL(metaMatch[1].replace(/['"]/g, ''), baseUrl).href;
            }
            catch { }
        }
        // JS: location.replace("url") or location.replace('url')
        const replaceMatch = body.match(/location\.replace\(\s*["']([^"']+)["']\s*\)/);
        if (replaceMatch) {
            try {
                return new URL(replaceMatch[1], baseUrl).href;
            }
            catch { }
        }
        // JS: window.location.href = "url" or window.location = "url"
        const windowLocMatch = body.match(/window\.location(?:\.href)?\s*=\s*["']([^"']+)["']/);
        if (windowLocMatch) {
            try {
                return new URL(windowLocMatch[1], baseUrl).href;
            }
            catch { }
        }
        // JS: location.href = "url" (without window.)
        const locHrefMatch = body.match(/(?<![.\w])location\.href\s*=\s*["']([^"']+)["']/);
        if (locHrefMatch) {
            try {
                return new URL(locHrefMatch[1], baseUrl).href;
            }
            catch { }
        }
        return undefined;
    }
    /**
     * Check if response body contains any global skip_text phrase (parked/expired domains)
     * @returns The matched phrase, or undefined if no match
     */
    containsSkipText(body) {
        if (!body || !this.config.skip_text || this.config.skip_text.length === 0) {
            return undefined;
        }
        for (const phrase of this.config.skip_text) {
            if (body.includes(phrase)) {
                return phrase;
            }
        }
        return undefined;
    }
    isAntibotResponse(response, url) {
        // Check status codes
        if (this.config.antibot.detectCodes.includes(response.status)) {
            return true;
        }
        // Check URL pattern
        if (url.includes(this.config.antibot.detectUrlPattern)) {
            return true;
        }
        return false;
    }
    extractHostWithoutQuery(url) {
        try {
            const parsed = new URL(url);
            return parsed.hostname.toLowerCase();
        }
        catch {
            return "";
        }
    }
    /**
     * Normalize URL (add https:// if missing) and extract hostname
     * This is a convenience method that combines normalizeUrl + extractHostWithoutQuery
     */
    normalizeAndExtractHost(url) {
        const normalized = this.normalizeUrl(url);
        return this.extractHostWithoutQuery(normalized);
    }
    extractPathWithoutQuery(url) {
        try {
            const parsed = new URL(url);
            return parsed.pathname;
        }
        catch {
            return "";
        }
    }
    /**
     * Format redirect chain compactly:
     * - If chain <= 3: show all
     * - If chain > 3: show first, "... (N redirects) ...", last
     */
    formatRedirectChain(chain) {
        if (chain.length === 0)
            return "";
        if (chain.length <= 3) {
            return chain.map((e) => `${e.url} (${e.statusCode})`).join(" -> ");
        }
        const first = chain[0];
        const last = chain[chain.length - 1];
        const middleCount = chain.length - 2;
        return `${first.url} (${first.statusCode}) -> ... (${middleCount} redirects) ... -> ${last.url} (${last.statusCode})`;
    }
}

// EXTERNAL MODULE: ./node_modules/table/dist/src/index.js
var src = __nccwpck_require__(4112);
;// CONCATENATED MODULE: ./src/replacer.ts
// Domains replacement logic
// Supports cosmetic rules, URL rules, and parameter lists




// Helper function for consistent domain normalization (www-aware)
function normalizeDomain(domain) {
    return domain.replace(/^www\./, '').toLowerCase();
}
// Helper functions for domain pattern detection
function matchesNumericPattern(domain) {
    const norm = normalizeDomain(domain);
    // Supports domain[N].tld, domain[N][text].tld, and [N]domain.tld patterns
    return /^[\w-]*\d+[\w-]*\.[a-z]{2,}$/.test(norm);
}
function extractBasePattern(domain) {
    const norm = normalizeDomain(domain);
    // Replace numeric part with {N}, preserving text before and after number
    return norm.replace(/\d+/, '{N}');
}
function matchesSamePattern(domain1, domain2) {
    return extractBasePattern(domain1) === extractBasePattern(domain2);
}
function matchesPattern(domain, pattern) {
    const norm = normalizeDomain(domain);
    const regex = new RegExp(pattern.replace('{N}', '\\d+'));
    return regex.test(norm);
}
function replaceDomain(domain, hostMap, initialToLastKnownMap) {
    // Skip empty strings and invalid domains
    if (!domain || domain.trim() === '') {
        return domain;
    }
    // Wildcard domains should NOT be replaced - keep them as is
    if (domain.includes('*')) {
        return domain;
    }
    // Try exact match first, then initial_domain lookup (both O(1))
    const exactMatch = hostMap.get(domain) || initialToLastKnownMap.get(domain);
    if (exactMatch) {
        return exactMatch;
    }
    return domain;
}
function hasSchemeChangeInList(originalDomains, replacedDomains) {
    for (let i = 0; i < originalDomains.length; i++) {
        const oldDomain = originalDomains[i];
        const newDomain = replacedDomains[i];
        if (newDomain && newDomain !== oldDomain &&
            matchesNumericPattern(oldDomain) &&
            !matchesSamePattern(oldDomain, newDomain)) {
            return true; // Found at least one scheme change
        }
    }
    return false;
}
function handleSchemeChange(originalDomains, replacedDomains, priorityMap) {
    // Find any numeric pattern domain to extract pattern
    const numericDomain = originalDomains.find(d => matchesNumericPattern(d));
    if (!numericDomain)
        return replacedDomains;
    const oldPattern = extractBasePattern(numericDomain);
    const filtered = replacedDomains.filter(d => !matchesPattern(d, oldPattern));
    // CRITICAL: Prevent empty domain list - restore fallback if all domains were removed
    if (filtered.length === 0) {
        // Priority 1: last_known_mirror matching the same pattern
        if (priorityMap.size > 0) {
            for (const { lastKnown } of priorityMap.values()) {
                if (matchesNumericPattern(lastKnown) && extractBasePattern(lastKnown) === oldPattern) {
                    return [lastKnown];
                }
            }
        }
        // Priority 2: first valid original domain as fallback
        const validOriginal = originalDomains.find(d => d && d.trim() !== '');
        if (validOriginal) {
            return [validOriginal];
        }
        // Priority 3: first replaced domain (safety net if logic failed)
        if (replacedDomains.length > 0) {
            return [replacedDomains[0]];
        }
    }
    return filtered;
}
function deduplicateDomains(domains) {
    const seen = new Set();
    return domains.filter(d => {
        const norm = normalizeDomain(d);
        if (seen.has(norm))
            return false;
        seen.add(norm);
        return true;
    });
}
function processDomainList(domains, hostMap, initialToLastKnownMap, priorityMap, additionalDomainsMap = new Map()) {
    // 1. Replace domains
    const replaced = domains.map(d => replaceDomain(d, hostMap, initialToLastKnownMap));
    const changed = domains.some((d, i) => replaced[i] !== d);
    // 2. Check for scheme change
    const schemeChangeDetected = hasSchemeChangeInList(domains, replaced);
    let processed = replaced;
    // 3. Handle scheme change (remove ALL domains of old pattern)
    if (schemeChangeDetected) {
        processed = handleSchemeChange(domains, replaced, priorityMap);
    }
    // 4. Remove predicted mirrors and deduplicate
    // Clean up predicted mirrors if domains changed OR if numeric patterns exist
    const hasNumericPatterns = domains.some(d => matchesNumericPattern(d));
    if ((changed || hasNumericPatterns) && priorityMap.size > 0) {
        // Always remove predicted mirrors if we have numeric patterns and active domains
        if (hasNumericPatterns && priorityMap.size > 0) {
            // Find matching last_known_mirror for current pattern
            const currentPattern = extractBasePattern(domains[0]);
            let matchingLastKnown = null;
            for (const { lastKnown } of priorityMap.values()) {
                if (matchesNumericPattern(lastKnown) && extractBasePattern(lastKnown) === currentPattern) {
                    matchingLastKnown = lastKnown;
                    break;
                }
            }
            // If we have matching last_known_mirror, remove predicted mirrors
            if (matchingLastKnown) {
                processed = removePredictedMirrors(processed, priorityMap);
                processed = deduplicateDomains(processed);
                // Ensure last_known_mirror is present
                if (!processed.some(d => normalizeDomain(d) === normalizeDomain(matchingLastKnown))) {
                    processed.push(matchingLastKnown);
                    processed = deduplicateDomains(processed);
                }
            }
        }
    }
    // 5. Append additional domains from force_search_ahead
    // If an additional domain normalizes to one already in the list, replace it
    // (use the form from redirect chain, e.g. www.webspor124.xyz instead of webspor124.xyz)
    if (additionalDomainsMap.size > 0) {
        const existingNormalized = new Map(); // normalized → index in processed
        for (let i = 0; i < processed.length; i++) {
            existingNormalized.set(normalizeDomain(processed[i]), i);
        }
        for (const d of [...processed]) {
            const key = normalizeDomain(d);
            const extras = additionalDomainsMap.get(key);
            if (extras) {
                for (const extra of extras) {
                    const extraNorm = normalizeDomain(extra);
                    const existingIdx = existingNormalized.get(extraNorm);
                    if (existingIdx !== undefined) {
                        // Replace existing domain with the form from redirect chain
                        processed[existingIdx] = extra;
                    }
                    else {
                        processed.push(extra);
                        existingNormalized.set(extraNorm, processed.length - 1);
                    }
                }
            }
        }
    }
    const finalChanged = changed || processed.length !== domains.length || domains.some((d, i) => processed[i] !== d);
    return { processed, changed: finalChanged, schemeChangeDetected };
}
class FilterReplacer {
    _config;
    _logger;
    _isTestMode;
    constructor(_config, _logger, _isTestMode = false) {
        this._config = _config;
        this._logger = _logger;
        this._isTestMode = _isTestMode;
    }
    async applyReplacements(replacements, dryRun = false, originalMirrors) {
        const replacerStart = Date.now();
        if (replacements.length === 0) {
            this._logger.logGlobal(LogLevel.INFO, "No replacements to process.");
            return { filesScanned: 0, filesModified: 0, totalLineEdits: 0, replacerSeconds: '0.000' };
        }
        // Build ASCII table: Site | From (startedHost) | To | Time
        // Show only actual domain changes in the table.
        // Deduplicate by siteName FIRST (keeping primary/effectiveNewHost entry),
        // then filter to only show entries where the domain actually changed
        // AND where newHost differs from the original last_known_mirror.
        const primaryBySite = new Map();
        for (const r of replacements) {
            if (!primaryBySite.has(r.siteName)) {
                primaryBySite.set(r.siteName, r);
            }
        }
        const uniqueChanges = [...primaryBySite.values()].filter(r => {
            // Skip if newHost matches the original mirror (not a real change)
            if (originalMirrors) {
                const originalMirror = originalMirrors.get(r.siteName);
                if (originalMirror && r.newHost === originalMirror)
                    return false;
            }
            const fromHost = r.startedHost || r.oldHost;
            return fromHost !== r.newHost;
        });
        if (uniqueChanges.length > 0) {
            const rows = [["Site", "From", "To", "Time"]];
            for (const { siteName, newHost, startedHost, oldHost, checkDurationMs } of uniqueChanges) {
                const fromHost = startedHost || oldHost;
                const timeStr = checkDurationMs ? `${(checkDurationMs / 1000).toFixed(2)}s` : "N/A";
                rows.push([siteName, fromHost, newHost, timeStr]);
            }
            const output = (0,src.table)(rows, {
                border: (0,src.getBorderCharacters)("honeywell"),
                drawHorizontalLine: (lineIndex, rowCount) => lineIndex === 0 || lineIndex === 1 || lineIndex === rowCount,
            });
            const header = `\n                      Redirected domains ${dryRun ? "(DRY RUN)" : ""}`;
            this._logger.logGlobal(LogLevel.RAW, `${header}\n${output}`);
        }
        else {
            this._logger.logGlobal(LogLevel.INFO, "No domain changes detected, but processing filters for predicted mirror cleanup.");
        }
        // Choose config based on mode
        const filtersConfig = this._isTestMode && this._config.filtersdir_test
            ? this._config.filtersdir_test
            : this._config.filtersdir;
        // Safety checks
        const repoPath = filtersConfig.repoPath;
        if (!repoPath) {
            this._logger.logGlobal(LogLevel.INFO, `${this._isTestMode && this._config.filtersdir_test ? 'filtersdir_test' : 'filtersdir'}.repoPath is empty. Skipping file replacements.`);
            return { filesScanned: 0, filesModified: 0, totalLineEdits: 0, replacerSeconds: '0.000' };
        }
        const filterDirPattern = filtersConfig.filterDirPattern || "*Filter";
        const filePattern = filtersConfig.filePattern || "*.txt";
        const files = await findTargetFiles(repoPath, filterDirPattern, filePattern);
        if (files.length === 0) {
            this._logger.logGlobal(LogLevel.INFO, "No target filter files found. Nothing to replace.");
            return { filesScanned: 0, filesModified: 0, totalLineEdits: 0, replacerSeconds: '0.000' };
        }
        // Log replacement phase start (moved to end)
        this._logger.logGlobal(LogLevel.DEBUG, "=== Domains replacement started ===");
        this._logger.logGlobal(LogLevel.DEBUG, `Files to scan: ${files.length}`);
        this._logger.logGlobal(LogLevel.DEBUG, `Files found: ${files.map(f => external_path_default().relative(repoPath, f)).join(", ")}`);
        // Build lookup maps from all replacements (not just actualChanges)
        // This ensures we process filters even when domain didn't change but has initial_domain
        // IMPORTANT: first write wins — the primary replacement (first occurrence) takes precedence
        // over additional domain replacements (force_search_ahead extras) that share the same oldHost.
        // This keeps hostMap in sync with seenPrimary/additionalDomainsMap which also use first-wins.
        const hostMap = new Map();
        for (const r of replacements) {
            if (!hostMap.has(r.oldHost)) {
                hostMap.set(r.oldHost, r.newHost);
            }
            // Also map initial_domain (startedHost) to newHost
            if (r.startedHost && r.startedHost !== r.oldHost && !hostMap.has(r.startedHost)) {
                hostMap.set(r.startedHost, r.newHost);
            }
        }
        // Build additionalDomainsMap: primary domain → additional domains from force_search_ahead + patternChangedDomain
        // Key is normalized primary domain, value is array of additional domains to add to filter lines
        const additionalDomainsMap = new Map();
        const seenPrimary = new Map(); // siteName → primary newHost
        for (const r of replacements) {
            if (!seenPrimary.has(r.siteName)) {
                // First replacement for this site is the primary domain
                seenPrimary.set(r.siteName, r.newHost);
                // Add patternChangedDomain if present (pattern_changed: true case)
                if (r.patternChangedDomain) {
                    const key = normalizeDomain(r.newHost);
                    if (!additionalDomainsMap.has(key)) {
                        additionalDomainsMap.set(key, []);
                    }
                    if (!additionalDomainsMap.get(key).includes(r.patternChangedDomain)) {
                        additionalDomainsMap.get(key).push(r.patternChangedDomain);
                    }
                }
            }
            else {
                // Subsequent replacements are additional domains from force_search_ahead
                const primary = seenPrimary.get(r.siteName);
                const key = normalizeDomain(primary);
                if (!additionalDomainsMap.has(key)) {
                    additionalDomainsMap.set(key, []);
                }
                if (!additionalDomainsMap.get(key).includes(r.newHost)) {
                    additionalDomainsMap.get(key).push(r.newHost);
                }
            }
        }
        // Build priorityMap: key = last_known_mirror (newHost)
        // This map is used by removePredictedMirrors to determine which domains to keep
        // Collect all working domains per site (including force_search_ahead results)
        const siteWorkingDomains = new Map();
        for (const r of replacements) {
            if (!siteWorkingDomains.has(r.siteName)) {
                siteWorkingDomains.set(r.siteName, new Set());
            }
            siteWorkingDomains.get(r.siteName).add(r.newHost);
        }
        const priorityMap = new Map();
        for (const r of replacements) {
            // Only add to priorityMap if domain matches numeric pattern
            // This ensures we only clean up predicted mirrors for sites that use this pattern
            if (matchesNumericPattern(r.newHost)) {
                // Only set once per site (use first occurrence)
                if (!priorityMap.has(r.newHost)) {
                    priorityMap.set(r.newHost, {
                        initial: r.startedHost || null,
                        lastKnown: r.newHost,
                        oldHost: r.oldHost,
                        workingDomains: siteWorkingDomains.get(r.siteName) || new Set(),
                    });
                }
            }
        }
        // Build O(1) lookup map: initial_domain -> last_known_mirror
        const initialToLastKnownMap = new Map();
        for (const { initial, lastKnown } of priorityMap.values()) {
            if (initial) {
                initialToLastKnownMap.set(initial, lastKnown);
            }
        }
        let modifiedFiles = 0;
        let totalLineEdits = 0;
        const fileChanges = [];
        for (const file of files) {
            let content;
            try {
                content = await external_fs_namespaceObject.promises.readFile(file, "utf-8");
            }
            catch (e) {
                this._logger.info("replacer", `Skip unreadable file: ${file}`);
                continue;
            }
            const lines = content.split(/\r?\n/);
            let changed = false;
            const lineChanges = [];
            for (let i = lines.length - 1; i >= 0; i--) {
                const original = lines[i];
                const updatedLines = processLine(original, hostMap, initialToLastKnownMap, priorityMap, additionalDomainsMap);
                // Check if line changed (first element differs) or extra lines were added
                if (updatedLines.length > 1 || updatedLines[0] !== original) {
                    lines.splice(i, 1, ...updatedLines);
                    changed = true;
                    totalLineEdits++;
                    lineChanges.push({ line: i + 1, before: original, after: updatedLines.join('\n') });
                }
            }
            if (changed) {
                modifiedFiles++;
                if (!dryRun) {
                    await external_fs_namespaceObject.promises.writeFile(file, lines.join("\n"), "utf-8");
                }
                fileChanges.push({ file, changes: lineChanges });
            }
        }
        // Log summary at the end
        const replacerDuration = Date.now() - replacerStart;
        const replacerSeconds = (replacerDuration / 1000).toFixed(3);
        if (fileChanges.length > 0) {
            const header = `    Changes by file${dryRun ? " (DRY RUN)" : ""}`;
            this._logger.logGlobal(LogLevel.DEBUG, header);
            for (const { file, changes } of fileChanges) {
                const relPath = external_path_default().relative(repoPath, file);
                for (const c of changes) {
                    this._logger.logGlobal(LogLevel.DEBUG, `    ${relPath}:${c.line}`);
                    this._logger.logGlobal(LogLevel.DEBUG, `[OLD] ${c.before}`);
                    this._logger.logGlobal(LogLevel.DEBUG, `[UPD] ${c.after}`);
                }
            }
        }
        this._logger.logGlobal(LogLevel.DEBUG, `=== Domains replacement finished ===\n`);
        return {
            filesScanned: files.length,
            filesModified: modifiedFiles,
            totalLineEdits: totalLineEdits,
            replacerSeconds: replacerSeconds
        };
    }
}
// ============================================================================
// Helper Functions
// ============================================================================
function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
async function findTargetFiles(root, dirPattern, filePattern) {
    const wantDirSuffix = dirPattern.replace(/\*/g, "");
    const wantExt = filePattern.startsWith("*.") ? filePattern.slice(1) : ".txt";
    const results = [];
    async function collectTxtRecursive(dir) {
        const entries = await external_fs_namespaceObject.promises.readdir(dir, { withFileTypes: true });
        for (const e of entries) {
            const full = external_path_default().join(dir, e.name);
            if (e.isDirectory()) {
                await collectTxtRecursive(full);
            }
            else if (e.isFile() && e.name.endsWith(wantExt)) {
                results.push(full);
            }
        }
    }
    async function walk(dir) {
        const entries = await external_fs_namespaceObject.promises.readdir(dir, { withFileTypes: true });
        for (const e of entries) {
            const full = external_path_default().join(dir, e.name);
            if (e.isDirectory()) {
                if (wantDirSuffix && e.name.endsWith(wantDirSuffix)) {
                    await collectTxtRecursive(full);
                }
                await walk(full);
            }
        }
    }
    await walk(root);
    return results;
}
function shouldSkipLine(line) {
    const t = line.trim();
    if (t.length === 0)
        return true;
    if (t.startsWith("!"))
        return true; // comments
    if (t.startsWith("/") && t.endsWith("/"))
        return true; // regex
    // Skip wildcard in URL patterns, but allow:
    // - cosmetic rules (##, #$#, #?#, #$?#, #%#)
    // - URL rules with parameters ($domain=, $denyallow=, etc.)
    if (t.includes("*")) {
        const hasCosmetic = t.includes("##") || t.includes("#$#") || t.includes("#?#") || t.includes("#$?#") || t.includes("#%#");
        const hasParams = t.includes("$");
        if (!hasCosmetic && !hasParams) {
            return true;
        }
    }
    return false;
}
/**
 * Check if domain matches predicted mirror pattern relative to baseDomain
 * Example: yavasgir31.com is predicted mirror of yavasgir34.com
 * Example: betist126tv.live is predicted mirror of betist131tv.live
 * Example: 7dizipal.com is predicted mirror of 8dizipal.com
 * Pattern: baseNameN.tld, baseNameN[text].tld, or N[baseName].tld where N is any number
 */
function isPredictedMirror(domain, baseDomain) {
    const d = normalizeDomain(domain);
    const base = normalizeDomain(baseDomain);
    // Try pattern 1: domain[N].tld or domain[N][text].tld (letters/hyphens before digits)
    let match = base.match(/^([a-z-]+)\d+[a-z-]*\./);
    if (match) {
        const baseName = escapeRegExp(match[1]);
        // Check if domain matches pattern: baseNameN.tld or baseNameN[text].tld
        return new RegExp(`^${baseName}\\d+[a-z-]*\\.[a-z]+$`).test(d) && d !== base;
    }
    // Try pattern 2: [N]domain.tld (digits before letters/hyphens)
    match = base.match(/^\d+([a-z-]+)\./);
    if (match) {
        const baseName = escapeRegExp(match[1]);
        // Check if domain matches pattern: N[baseName].tld
        return new RegExp(`^\\d+${baseName}\\.[a-z]+$`).test(d) && d !== base;
    }
    return false;
}
/**
 * Remove predicted mirrors, keep only:
 * - last_known_mirror (always)
 * - initial_domain (if not null)
 * - working domains from force_search_ahead (protection for working predicted domains)
 * - non-predicted domains (wildcards, etc.)
 */
function removePredictedMirrors(domains, priorityMap) {
    // If priorityMap is empty, cannot determine what to keep - return all domains
    if (priorityMap.size === 0) {
        return domains;
    }
    // Collect domains to keep and base domains for pattern matching
    const keep = new Set();
    const bases = [];
    for (const { initial, lastKnown, workingDomains } of priorityMap.values()) {
        keep.add(normalizeDomain(lastKnown));
        if (initial)
            keep.add(normalizeDomain(initial));
        // Add all working domains from force_search_ahead to protected set
        if (workingDomains) {
            for (const workingDomain of workingDomains) {
                keep.add(normalizeDomain(workingDomain));
            }
        }
        bases.push(lastKnown);
    }
    // Filter logic:
    // 1. If domain is in keep set (last_known_mirror, initial_domain, or working domain), always keep it
    // 2. If domain is NOT in keep set but matches predicted mirror pattern, remove it
    // 3. Otherwise keep it (wildcards, non-pattern domains, etc.)
    return domains.filter(domain => {
        const norm = normalizeDomain(domain);
        // Always keep last_known_mirror, initial_domain, and working domains
        if (keep.has(norm))
            return true;
        // Remove predicted mirrors (domains matching pattern but not in keep set)
        const isPredicted = bases.some(base => isPredictedMirror(domain, base));
        return !isPredicted;
    });
}
function processLine(line, hostMap, initialToLastKnownMap, priorityMap, additionalDomainsMap = new Map()) {
    if (shouldSkipLine(line))
        return [line];
    // Cosmetic rules: find marker (##, #$#, #?#, #$?#, #%#)
    let idx = -1;
    for (const sep of ["#$?#", "#$#", "#?#", "#%#", "##"]) {
        const pos = line.indexOf(sep);
        if (pos > 0 && (idx === -1 || pos < idx)) {
            idx = pos;
        }
    }
    if (idx > 0) {
        const left = line.slice(0, idx);
        const right = line.slice(idx);
        const parts = left.split(",").map(s => s.trim());
        // Process domain list with unified logic (includes additional domains appending)
        const { processed, changed } = processDomainList(parts, hostMap, initialToLastKnownMap, priorityMap, additionalDomainsMap);
        // Return updated line if domains changed OR if predicted mirrors were removed
        if (changed || processed.length !== parts.length) {
            return [`${processed.join(",")}${right}`];
        }
        return [line];
    }
    // URL rules and parameters
    let out = line;
    const extraLines = [];
    // Replace ||oldHost^ patterns and duplicate for additional domains
    for (const [oldHost, newHost] of hostMap.entries()) {
        if (oldHost === newHost)
            continue;
        const tokenRe = new RegExp(`\\|\\|${escapeRegExp(oldHost)}\\^`, "g");
        if (tokenRe.test(out)) {
            tokenRe.lastIndex = 0; // Reset after .test() to avoid skipping first match
            out = out.replace(tokenRe, `||${newHost}^`);
            // Add extra lines for additional domains
            const extras = additionalDomainsMap.get(normalizeDomain(newHost));
            if (extras) {
                for (const extra of extras) {
                    extraLines.push(out.replace(new RegExp(`\\|\\|${escapeRegExp(newHost)}\\^`, 'g'), `||${extra}^`));
                }
            }
        }
    }
    // Replace domains in URL parameters ($param=domain1|domain2)
    const paramMatch = out.match(/\$([^$]+)$/);
    if (paramMatch) {
        const params = paramMatch[1];
        let updatedParams = params;
        // Find all param=value pairs
        const paramPairs = params.split(",");
        const newPairs = [];
        for (const pair of paramPairs) {
            const eqIdx = pair.indexOf("=");
            if (eqIdx === -1) {
                newPairs.push(pair);
                continue;
            }
            const paramName = pair.slice(0, eqIdx);
            const paramValue = pair.slice(eqIdx + 1);
            // Check if value contains domain list (separated by |)
            if (paramValue.includes("|")) {
                const domains = paramValue.split("|").map(d => d.trim());
                // Process domain list with unified logic (includes additional domains appending)
                const { processed, changed } = processDomainList(domains, hostMap, initialToLastKnownMap, priorityMap, additionalDomainsMap);
                // Update if domains changed OR if predicted mirrors were removed
                if (changed || processed.length !== domains.length) {
                    newPairs.push(`${paramName}=${processed.join("|")}`);
                }
                else {
                    newPairs.push(pair);
                }
            }
            else {
                // Handle single domain in parameter
                const replacedDomain = replaceDomain(paramValue, hostMap, initialToLastKnownMap);
                if (replacedDomain !== paramValue) {
                    newPairs.push(`${paramName}=${replacedDomain}`);
                }
                else {
                    newPairs.push(pair);
                }
            }
        }
        updatedParams = newPairs.join(",");
        if (updatedParams !== params) {
            out = out.replace(`$${params}`, `$${updatedParams}`);
        }
    }
    const result = [out, ...extraLines];
    return result;
}
// Exports for testing


;// CONCATENATED MODULE: external "child_process"
const external_child_process_namespaceObject = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("child_process");
;// CONCATENATED MODULE: ./src/git.ts




class GitManager {
    config;
    logger;
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
    }
    async commitOrCreatePR(summary, dryRun) {
        if (summary.replacements.length === 0) {
            if (this.logger) {
                this.logger.logGlobal(LogLevel.INFO, "No changes to commit.");
            }
            return {};
        }
        const message = this.buildCommitMessage(summary);
        if (dryRun) {
            // Dry run - simulate git operations
            if (this.logger) {
                this.logger.logGlobal(LogLevel.INFO, "⬇️ ⬇️ ⬇️  💡 💡 💡  DRY RUN: Simulating Git Operations 💡 💡 💡  ⬇️ ⬇️ ⬇️");
                this.logger.logGlobal(LogLevel.INFO, `Mode: ${this.config.git.mode === 'debug' ? 'Pull Request' : 'Direct Commit'}`);
                this.logger.logGlobal(LogLevel.INFO, `Target branch: ${this.config.git.branch}`);
                this.logger.logGlobal(LogLevel.INFO, `Replacements: ${summary.replacements.length}`);
                this.logger.logGlobal(LogLevel.INFO, "Commit message:");
                this.logger.logGlobal(LogLevel.INFO, message);
                this.logger.logGlobal(LogLevel.INFO, "⬆️ ⬆️ ⬆️  💡 💡 💡  DRY RUN: Simulating Git Operations 💡 💡 💡  ⬆️ ⬆️ ⬆️");
                this.logger.logRaw("");
            }
            return {};
        }
        else if (this.config.git.mode === "debug") {
            // Debug mode - create pull request
            return await this.createPullRequest(summary, message);
        }
        else {
            // Production mode - commit directly to master
            return await this.commitDirectly(summary, message);
        }
    }
    buildCommitMessage(summary) {
        const lines = ["Rotating Domains Checker: Updating domains"];
        // Group errors by type
        const errorsByType = {
            antibot_blocked: summary.errors.filter(e => e.type === 'antibot_blocked'),
            antibot_accepted: summary.errors.filter(e => e.type === 'antibot_accepted'),
            dns: summary.errors.filter(e => e.type === 'dns'),
            http: summary.errors.filter(e => e.type === 'http'),
            probe: summary.errors.filter(e => e.type === 'probe'),
            network: summary.errors.filter(e => e.type === 'network'),
        };
        // Add replacements section - show all actual changes like in the log table
        // Deduplicate by siteName FIRST (primary/effectiveNewHost entry), then filter actual changes
        const primaryBySite = new Map();
        for (const r of summary.replacements) {
            if (!primaryBySite.has(r.siteName)) {
                primaryBySite.set(r.siteName, r);
            }
        }
        const uniqueChanges = [...primaryBySite.values()].filter(r => {
            const fromHost = r.startedHost || r.oldHost;
            return fromHost !== r.newHost;
        });
        if (uniqueChanges.length > 0) {
            lines.push("\n🔄  Updated domains:\n");
            const maxSiteNameLength = Math.max(...uniqueChanges.map(r => r.siteName.length));
            const maxDomainLength = Math.max(...uniqueChanges.map(r => (r.startedHost || r.oldHost).length));
            const maxFilterLength = Math.max(...uniqueChanges.map(r => r.newHost.length));
            const siteNamePadding = Math.max(maxSiteNameLength, 30);
            const domainPadding = Math.max(maxDomainLength, 20);
            const filterPadding = Math.max(maxFilterLength, 20);
            for (const replacement of uniqueChanges) {
                const siteNamePadded = replacement.siteName.padEnd(siteNamePadding);
                const fromHost = replacement.startedHost || replacement.oldHost;
                const domainPadded = fromHost.padEnd(domainPadding);
                const filterPadded = replacement.newHost.padEnd(filterPadding);
                lines.push(`${siteNamePadded}   ${domainPadded} → ${filterPadded}`);
            }
            lines.push("");
        }
        // If no domain changes but replacements exist, summarize what happened
        else if (summary.replacements.length > 0) {
            lines.push("\n🔄  Domain updates: 0 (mirror cleanup only)");
            // List sites that had replacements (even if no domain change)
            const allSiteNames = [...new Set(summary.replacements.map(r => r.siteName))];
            if (allSiteNames.length > 0) {
                lines.push("");
                lines.push(`Sites processed: ${allSiteNames.join(", ")}`);
            }
        }
        // Show errors that are actual failures (not accepted antibot)
        const realErrors = summary.errors.filter(e => e.type !== 'antibot_accepted');
        if (realErrors.length > 0) {
            lines.push("🚨 Errors (no replacements made):");
            for (const { siteName, error, domain, checkDurationMs } of realErrors) {
                const domainInfo = domain ? ` [${domain}]` : '';
                const timeInfo = checkDurationMs ? ` (${(checkDurationMs / 1000).toFixed(2)}s)` : '';
                lines.push(`     - ${siteName}${domainInfo}: ${error}${timeInfo}`);
            }
        }
        if (summary.warnings.length > 0) {
            lines.push("\n");
            lines.push("⚠️  Warnings:");
            for (const warning of summary.warnings) {
                lines.push(`     - ${warning}`);
            }
        }
        // Show accepted antibot separately if any
        if (errorsByType.antibot_accepted.length > 0) {
            lines.push("\n⚠️  Antibot accepted (ignored by config):");
            for (const { siteName, error, domain, checkDurationMs } of errorsByType.antibot_accepted) {
                const domainInfo = domain ? ` [${domain}]` : '';
                const timeInfo = checkDurationMs ? ` (${(checkDurationMs / 1000).toFixed(2)}s)` : '';
                lines.push(`     - ${siteName}${domainInfo}: ${error}${timeInfo}`);
            }
        }
        // Add artifact link if running in GitHub Actions
        if (process.env.GITHUB_ACTIONS) {
            const runId = process.env.GITHUB_RUN_ID;
            const repo = process.env.GITHUB_REPOSITORY;
            if (runId && repo) {
                lines.push("\n");
                lines.push(`📋  View detailed log: https://github.com/${repo}/actions/runs/${runId}#artifacts`);
            }
        }
        return lines.join("\n");
    }
    async commitDirectly(summary, message) {
        try {
            if (this.logger) {
                this.logger.logGlobal(LogLevel.INFO, "=== Direct Commit Mode ===");
                this.logger.logGlobal(LogLevel.INFO, `Target branch: ${this.config.git.branch}`);
                this.logger.logGlobal(LogLevel.INFO, `Replacements: ${summary.replacements.length}`);
                this.logger.logGlobal(LogLevel.INFO, "Commit message:");
                this.logger.logGlobal(LogLevel.INFO, message);
            }
            // Check if there are changes to commit
            const gitStatus = (0,external_child_process_namespaceObject.execSync)('git status --porcelain', { encoding: 'utf8' });
            if (!gitStatus.trim()) {
                if (this.logger) {
                    this.logger.logGlobal(LogLevel.INFO, "No changes to commit");
                }
                return {};
            }
            // Add and commit changes directly to master
            (0,external_child_process_namespaceObject.execSync)('git add -A', { encoding: 'utf8' });
            // Use stdin to avoid command injection from commit message
            (0,external_child_process_namespaceObject.execSync)('git commit -F -', { input: message, encoding: 'utf8' });
            // Get commit SHA
            const commitSha = (0,external_child_process_namespaceObject.execSync)('git rev-parse HEAD', { encoding: 'utf8' }).trim();
            // Push to master
            (0,external_child_process_namespaceObject.execSync)(`git push origin ${this.config.git.branch}`, { encoding: 'utf8' });
            if (this.logger) {
                this.logger.logGlobal(LogLevel.INFO, "✅ Changes committed directly to master");
                this.logger.logGlobal(LogLevel.INFO, `🔗 Branch: ${this.config.git.branch}`);
                this.logger.logGlobal(LogLevel.INFO, `🔗 Commit: ${commitSha}`);
                this.logger.logRaw("");
            }
            return { commitSha };
        }
        catch (error) {
            if (this.logger) {
                this.logger.logGlobal(LogLevel.ERROR, `❌ Failed to commit directly: ${error}`);
            }
            throw error;
        }
    }
    async createPullRequest(summary, message) {
        try {
            if (this.logger) {
                this.logger.logGlobal(LogLevel.INFO, "=== Creating Pull Request ===");
                this.logger.logGlobal(LogLevel.INFO, `Replacements: ${summary.replacements.length}`);
            }
            // Check if there are changes to commit
            const gitStatus = (0,external_child_process_namespaceObject.execSync)('git status --porcelain', { encoding: 'utf8' });
            if (!gitStatus.trim()) {
                if (this.logger) {
                    this.logger.logGlobal(LogLevel.INFO, "No changes to commit");
                }
                return {};
            }
            // Create branch with timestamp to avoid conflicts
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
            const branchName = `${this.config.git.prBranchPrefix}/${dateStr}-${timeStr}`;
            if (this.logger) {
                this.logger.logGlobal(LogLevel.INFO, `Creating branch: ${branchName}`);
            }
            (0,external_child_process_namespaceObject.execSync)(`git checkout -b "${branchName}"`, { encoding: 'utf8' });
            // Add and commit changes
            (0,external_child_process_namespaceObject.execSync)('git add -A', { encoding: 'utf8' });
            // Use stdin to avoid command injection from commit message
            (0,external_child_process_namespaceObject.execSync)('git commit -F -', { input: message, encoding: 'utf8' });
            // Push branch
            (0,external_child_process_namespaceObject.execSync)(`git push origin "${branchName}"`, { encoding: 'utf8' });
            // Create PR using GitHub CLI with script-generated commit message
            const prTitle = message.split('\n')[0]; // Use first line of commit message as PR title
            const prBody = `${message}

---

## Changes
- Updated domain names in filter rules
- Updated watchers.yml with new last_known_mirror values

## Verification
Please review the changes before merging.

---
*This PR was created automatically by Rotating Domains Checker*`;
            // Create temporary directory and file for PR body to avoid command injection
            const tempDir = (0,external_fs_namespaceObject.mkdtempSync)((0,external_path_namespaceObject.join)(process.cwd(), 'pr-temp-'));
            const prBodyFile = (0,external_path_namespaceObject.join)(tempDir, 'pr-body.txt');
            try {
                (0,external_fs_namespaceObject.writeFileSync)(prBodyFile, prBody, 'utf8');
                // Use execFileSync to bypass shell entirely — prevents injection via prTitle
                (0,external_child_process_namespaceObject.execFileSync)('gh', [
                    'pr', 'create',
                    '--title', prTitle,
                    '--body-file', prBodyFile,
                    '--head', branchName,
                    '--base', this.config.git.branch,
                ], { encoding: 'utf8' });
            }
            finally {
                // Clean up temporary directory and file
                try {
                    (0,external_fs_namespaceObject.rmSync)(tempDir, { recursive: true, force: true });
                }
                catch {
                    // Ignore cleanup errors
                }
            }
            // Get commit SHA and PR number
            const commitSha = (0,external_child_process_namespaceObject.execSync)('git rev-parse HEAD', { encoding: 'utf8' }).trim();
            const prNumber = parseInt((0,external_child_process_namespaceObject.execSync)(`gh pr view --json number --jq '.number'`, { encoding: 'utf8' }).trim());
            if (this.logger) {
                this.logger.logGlobal(LogLevel.INFO, `✅ Pull request created: ${prTitle}`);
                this.logger.logGlobal(LogLevel.INFO, `🔗 Branch: ${branchName}`);
                this.logger.logGlobal(LogLevel.INFO, `🔗 Pull Request: #${prNumber}`);
                this.logger.logGlobal(LogLevel.INFO, `🔗 Commit SHA: ${commitSha}`);
                this.logger.logRaw("");
            }
            return { commitSha, prNumber };
        }
        catch (error) {
            if (this.logger) {
                this.logger.logGlobal(LogLevel.ERROR, `❌ Failed to create pull request: ${error}`);
            }
            throw error;
        }
    }
    getPRModeInfo(summary, dryRun) {
        const lines = [];
        if (dryRun || this.config.git.mode === 'debug') {
            lines.push("⬇️ ⬇️ ⬇️  💡 💡 💡  Pull Request Mode 💡 💡 💡  ⬇️ ⬇️ ⬇️");
            lines.push(`Branch: ${this.config.git.prBranchPrefix}/${new Date().toISOString().split("T")[0]}`);
            lines.push("Commit message:");
            lines.push(this.buildCommitMessage(summary));
            lines.push("⬆️ ⬆️ ⬆️  💡 💡 💡  Pull Request Mode 💡 💡 💡  ⬆️ ⬆️ ⬆️");
            lines.push("");
        }
        else {
            lines.push("⬇️ ⬇️ ⬇️  💡 💡 💡  Direct Commit Mode 💡 💡 💡  ⬇️ ⬇️ ⬇️");
            lines.push(`Target branch: ${this.config.git.branch}`);
            lines.push("Commit message:");
            lines.push(this.buildCommitMessage(summary));
            lines.push("⬆️ ⬆️ ⬆️  💡 💡 💡  Direct Commit Mode 💡 💡 💡  ⬆️ ⬆️ ⬆️");
            lines.push("");
        }
        return lines;
    }
}

;// CONCATENATED MODULE: external "node:diagnostics_channel"
const external_node_diagnostics_channel_namespaceObject = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("node:diagnostics_channel");
var external_node_diagnostics_channel_default = /*#__PURE__*/__nccwpck_require__.n(external_node_diagnostics_channel_namespaceObject);
;// CONCATENATED MODULE: ./src/diagnostics.ts
// Undici connection pool diagnostics


class ConnectionDiagnostics {
    pools = new Map();
    monitorInterval = null;
    logger = null;
    subscriptions = [];
    stopped = false;
    setLogger(logger) {
        this.logger = logger;
    }
    start() {
        if (this.stopped)
            return;
        // Subscribe to undici:client:connectError
        const sub1 = external_node_diagnostics_channel_default().subscribe("undici:client:connectError", (message) => {
            if (!this.stopped && this.logger) {
                this.logger.logGlobal(LogLevel.DEBUG, `CONNECTION Connection error: ${message.error?.message || "unknown"}`);
            }
        });
        this.subscriptions.push(sub1);
        // Subscribe to undici:client:connected
        const sub2 = external_node_diagnostics_channel_default().subscribe("undici:client:connected", (message) => {
            if (!this.stopped) {
                const origin = message.origin || "unknown";
                this.updatePoolStats(origin, { connected: 1 });
            }
        });
        this.subscriptions.push(sub2);
        // Subscribe to undici:client:disconnected
        const sub3 = external_node_diagnostics_channel_default().subscribe("undici:client:disconnected", (message) => {
            if (!this.stopped) {
                const origin = message.origin || "unknown";
                this.updatePoolStats(origin, { connected: -1 });
            }
        });
        this.subscriptions.push(sub3);
        // Subscribe to undici:request:create
        const sub4 = external_node_diagnostics_channel_default().subscribe("undici:request:create", (message) => {
            if (!this.stopped) {
                const origin = message.origin || "unknown";
                this.updatePoolStats(origin, { running: 1 });
            }
        });
        this.subscriptions.push(sub4);
        // Subscribe to undici:request:trailers
        const sub5 = external_node_diagnostics_channel_default().subscribe("undici:request:trailers", (message) => {
            if (!this.stopped) {
                const origin = message.origin || "unknown";
                this.updatePoolStats(origin, { running: -1 });
            }
        });
        this.subscriptions.push(sub5);
        // Start periodic monitoring
        this.monitorInterval = setInterval(() => {
            if (!this.stopped) {
                this.printStats();
            }
        }, 10000); // Every 10 seconds
    }
    stop() {
        this.stopped = true;
        // Clear monitor interval
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
        // Unsubscribe from all channels
        this.subscriptions.forEach(sub => {
            if (sub && typeof sub.unsubscribe === 'function') {
                sub.unsubscribe();
            }
        });
        this.subscriptions = [];
        // Print final stats
        this.printStats();
    }
    updatePoolStats(origin, delta) {
        const current = this.pools.get(origin) || {
            connected: 0,
            free: 0,
            pending: 0,
            queued: 0,
            running: 0,
            size: 0,
        };
        for (const [key, value] of Object.entries(delta)) {
            const k = key;
            current[k] = Math.max(0, current[k] + (value || 0));
        }
        this.pools.set(origin, current);
    }
    printStats() {
        if (!this.logger)
            return;
        const totalConnected = Array.from(this.pools.values()).reduce((sum, p) => sum + p.connected, 0);
        const totalRunning = Array.from(this.pools.values()).reduce((sum, p) => sum + p.running, 0);
        this.logger.logGlobal(LogLevel.DEBUG, `HTTP POOL: ${totalConnected} active connections, ${totalRunning} requests in progress across ${this.pools.size} domains`);
        // Show top 5 domains with most connections
        const sorted = Array.from(this.pools.entries())
            .filter(([, stats]) => stats.connected > 0 || stats.running > 0)
            .sort((a, b) => b[1].connected - a[1].connected)
            .slice(0, 5);
        if (sorted.length > 0) {
            // Filter out "unknown" to show only real domains
            const knownDomains = sorted.filter(([origin]) => origin !== "unknown");
            if (knownDomains.length > 0) {
                const originsInfo = knownDomains.map(([origin, stats]) => `${origin}: ${stats.connected} connections, ${stats.running} requests`).join(', ');
                this.logger.logGlobal(LogLevel.DEBUG, `HTTP POOL: Connection details: ${originsInfo}`);
            }
        }
    }
}
const connectionDiagnostics = new ConnectionDiagnostics();

;// CONCATENATED MODULE: ./src/index.ts








// Version
const VERSION = "1.1.15";
/**
 * Natural comparison for domain names - compares numeric chunks as numbers.
 * Example: example9 < example18 < example20 (not lexicographic: example18 < example20 < example9)
 */
function naturalCompare(a, b) {
    const re = /(\d+)|(\D+)/g;
    const chunksA = a.match(re) ?? [a];
    const chunksB = b.match(re) ?? [b];
    for (let i = 0; i < Math.max(chunksA.length, chunksB.length); i++) {
        const ca = chunksA[i] ?? '';
        const cb = chunksB[i] ?? '';
        const na = parseInt(ca, 10);
        const nb = parseInt(cb, 10);
        if (!isNaN(na) && !isNaN(nb)) {
            if (na !== nb)
                return na - nb;
        }
        else {
            if (ca < cb)
                return -1;
            if (ca > cb)
                return 1;
        }
    }
    return 0;
}
/**
 * From newHost + additionalWorkingDomains, pick the first domain after natural sorting.
 * This ensures consistent, deterministic selection (lowest-numbered pattern domain first).
 */
function selectFirstByOrder(newHost, additionalDomains) {
    if (!additionalDomains || additionalDomains.length === 0)
        return newHost;
    const all = [newHost, ...additionalDomains];
    all.sort(naturalCompare);
    return all[0];
}
function formatDateTime(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`; // Date only to reduce git diff noise for last_seen
}
function calculateDaysSince(dateStr) {
    if (!dateStr)
        return 0;
    try {
        const past = new Date(dateStr.replace(" ", "T"));
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - past.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }
    catch {
        return 0;
    }
}
async function main() {
    // Capture start time as early as possible
    const startTime = new Date();
    // GitHub Actions inputs
    const configPath = process.env.INPUT_CONFIG_PATH || './config.yml';
    const inputMode = process.env.INPUT_MODE || '';
    const filtersPath = process.env.INPUT_FILTERS_PATH || './';
    // Parse mode from command line arguments or GitHub Actions
    const cliMode = process.argv.find(arg => arg.startsWith('--mode='))?.split('=')[1];
    const mode = inputMode || cliMode || 'prod_live';
    // Determine flags based on mode
    const dryRun = mode === 'prod_dry' || mode === 'test_dry';
    const isTestMode = mode === 'test_live' || mode === 'test_dry';
    // Load configuration using configPath
    const config = loadConfig(configPath);
    const watchers = loadWatchers();
    const logger = new Logger(config);
    // Save original last_known_mirror values BEFORE processing
    // Used later to detect if newHost was already known (not a real change)
    const originalLastKnownMirrors = new Map();
    for (const [siteName, site] of Object.entries(watchers.sites)) {
        if (site.last_known_mirror) {
            originalLastKnownMirrors.set(siteName, site.last_known_mirror);
        }
    }
    // Use filtersPath for target directory
    const targetPath = isTestMode && config.filtersdir_test
        ? config.filtersdir_test.repoPath
        : (filtersPath || config.filtersdir.repoPath);
    logger.logGlobal(LogLevel.RAW, `Rotating Domains Checker v${VERSION} - ${dryRun ? "DRY RUN" : "WRITE"} mode`);
    logger.logGlobal(LogLevel.RAW, `Test filters dir: ${isTestMode ? "YES" : "NO"}`);
    logger.logGlobal(LogLevel.RAW, `Target repo path: ${targetPath}`);
    logger.logGlobal(LogLevel.RAW, `Sites to check: ${Object.keys(watchers.sites).length}\n`);
    logger.logGlobal(LogLevel.INFO, "=== Domain checks started ===");
    // Start connection diagnostics
    connectionDiagnostics.setLogger(logger);
    connectionDiagnostics.start();
    // Process all sites in batches
    const resolver = new HttpResolver(config);
    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const batchStartTime = Date.now();
    const results = await processor.processAll();
    const batchDuration = Date.now() - batchStartTime;
    const batchSeconds = (batchDuration / 1000).toFixed(3);
    // Build summary
    const summary = {
        totalSites: Object.keys(watchers.sites).length,
        checked: results.length,
        updated: 0,
        unchanged: 0,
        failed: 0,
        antibotAccepted: 0,
        antibotBlocked: 0,
        replacements: [],
        errors: [],
        warnings: [],
    };
    const now = new Date();
    const nowFormatted = formatDateTime(now);
    const nowDateOnly = formatDate(now);
    for (const result of results) {
        const site = watchers.sites[result.siteName];
        if (!site)
            continue;
        // Determine error type and category
        const isAntibotDetected = result.result.antibotDetected;
        const isAntibotAccepted = isAntibotDetected && site.accept_antibot;
        // Heuristic found a non-pattern domain: history/flags already updated in batch.ts,
        // last_known_mirror should be updated but filters must NOT be touched.
        const isHeuristicNonPattern = result.historyUpdated && !result.shouldUpdate && result.result.success;
        // Check if failed: HTTP error OR content probe failed, but NOT accepted antibot
        const isFailed = (!result.result.success || (result.error && !result.shouldUpdate)) && !isAntibotAccepted && !isHeuristicNonPattern;
        if (isFailed) {
            // Determine error type
            let errorType;
            const errorMsg = result.error || result.result.error || "Unknown error";
            const checkedDomain = result.actualCheckedDomain || result.startedHost || result.oldHost;
            if (result.result.skippedByText) {
                errorType = 'skip_text';
            }
            else if (isAntibotDetected) {
                errorType = 'antibot_blocked';
            }
            else if (errorMsg.includes('DNS') || errorMsg.includes('ENOTFOUND') || errorMsg.includes('EAI_AGAIN')) {
                errorType = 'dns';
            }
            else if (errorMsg.includes('probe failed')) {
                errorType = 'probe';
            }
            else if (errorMsg.includes('status:') || errorMsg.match(/\d{3}/)) {
                errorType = 'http';
            }
            else {
                errorType = 'network';
            }
            // Real failure
            summary.failed++;
            summary.errors.push({
                siteName: result.siteName,
                error: errorMsg,
                domain: checkedDomain,
                type: errorType,
                checkDurationMs: result.checkDurationMs,
            });
            if (isAntibotDetected) {
                summary.antibotBlocked++;
            }
            // Update failed_since and calculate failed_days
            if (!site.failed_since) {
                // First failure - set failed_since to now
                site.failed_since = nowFormatted;
                site.failed_days = 0;
            }
            else {
                // Subsequent failure - calculate days since first failure
                site.failed_days = calculateDaysSince(site.failed_since);
            }
            // Mark as potentially dead if no working domain found
            site.potentially_dead = true;
            if ((site.failed_days || 0) >= config.thresholds.failedDaysWarning) {
                summary.warnings.push(`${result.siteName}: Failed for ${site.failed_days} days - consider removing from filters`);
            }
        }
        else if (isHeuristicNonPattern) {
            // Heuristic found a non-pattern domain (e.g. hepbetspor12.cfd → patronspor.is).
            // History and flags already set in batch.ts. Update last_known_mirror and counters,
            // but do NOT touch filter files — the old pattern domain stays until a new pattern is found.
            summary.updated++;
            site.last_known_mirror = selectFirstByOrder(result.newHost, result.additionalWorkingDomains);
            site.last_seen = nowDateOnly;
            delete site.failed_days;
            delete site.failed_since;
            delete site.potentially_dead;
            summary.warnings.push(`${result.siteName}: Pattern domain redirected to non-pattern (${result.oldHost} → ${result.newHost}) - filter not updated, waiting for new pattern domain`);
        }
        else if (isAntibotAccepted && result.shouldUpdate) {
            // Antibot accepted: compute effective new host first to check if anything actually changed
            const effectiveNewHostAntibot = selectFirstByOrder(result.newHost, result.additionalWorkingDomains);
            const antibotActuallyChanged = effectiveNewHostAntibot !== site.last_known_mirror;
            if (antibotActuallyChanged) {
                summary.antibotAccepted++;
                // Add to errors list for reporting (but not counted as failed)
                const errorMsg = result.error || result.result.error || "Antibot detected, but accepted by config";
                const checkedDomain = result.actualCheckedDomain || result.startedHost || result.oldHost;
                summary.errors.push({
                    siteName: result.siteName,
                    error: errorMsg,
                    domain: checkedDomain,
                    type: 'antibot_accepted',
                    checkDurationMs: result.checkDurationMs,
                });
                // Add warning for filter maintainers about antibot protection
                const fromHost = result.startedHost || result.oldHost;
                summary.warnings.push(`${result.siteName}: Domain redirected (${fromHost} → ${effectiveNewHostAntibot}) but protected by antibot - old domain may remain in filter rules`);
                summary.updated++;
                // Get last pattern domain from history if pattern_changed is true
                const patternChangedDomain = site.pattern_changed && site.heuristic_history && site.heuristic_history.length > 0
                    ? site.heuristic_history[site.heuristic_history.length - 1]
                    : undefined;
                // Primary replacement entry uses effectiveNewHostAntibot
                summary.replacements.push({
                    oldHost: result.oldHost,
                    newHost: effectiveNewHostAntibot,
                    siteName: result.siteName,
                    startedHost: result.startedHost || "",
                    checkDurationMs: result.checkDurationMs,
                    patternChangedDomain,
                });
                // Additional working domains OTHER than effectiveNewHostAntibot
                const allWorkingDomainsAntibot = [result.newHost, ...(result.additionalWorkingDomains || [])];
                for (const additionalDomain of allWorkingDomainsAntibot) {
                    if (additionalDomain === effectiveNewHostAntibot)
                        continue;
                    summary.replacements.push({
                        oldHost: result.oldHost,
                        newHost: additionalDomain,
                        siteName: result.siteName,
                        startedHost: result.startedHost || "",
                        checkDurationMs: result.checkDurationMs,
                        patternChangedDomain,
                    });
                }
                // Update watcher
                const oldLastKnownMirrorAntibot = site.last_known_mirror;
                site.last_known_mirror = effectiveNewHostAntibot;
                if (result.hostChanged && !result.historyUpdated) {
                    processor.updateDomainHistory(site, effectiveNewHostAntibot, oldLastKnownMirrorAntibot);
                }
            }
            else {
                summary.unchanged++;
            }
            // Always update last_seen and reset failure flags on any antibot-accepted success
            site.last_seen = nowDateOnly;
            delete site.failed_days;
            delete site.failed_since;
            delete site.potentially_dead;
        }
        else if (result.shouldUpdate) {
            // Only update filters if check was successful
            if (result.result.success) {
                // Count as updated only if domain actually changed
                if (result.hostChanged) {
                    summary.updated++;
                }
                else {
                    summary.unchanged++;
                }
                // Get last pattern domain from history if pattern_changed is true
                const patternChangedDomain = site.pattern_changed && site.heuristic_history && site.heuristic_history.length > 0
                    ? site.heuristic_history[site.heuristic_history.length - 1]
                    : undefined;
                // Compute effective newHost with selectFirstByOrder BEFORE building replacements
                const effectiveNewHost = selectFirstByOrder(result.newHost, result.additionalWorkingDomains);
                // Primary replacement entry uses effectiveNewHost
                summary.replacements.push({
                    oldHost: result.oldHost,
                    newHost: effectiveNewHost,
                    siteName: result.siteName,
                    startedHost: result.startedHost || "",
                    checkDurationMs: result.checkDurationMs,
                    patternChangedDomain,
                });
                // Add replacements for additional working domains (force_search_ahead)
                // These are domains OTHER than effectiveNewHost
                const allWorkingDomains = [result.newHost, ...(result.additionalWorkingDomains || [])];
                for (const additionalDomain of allWorkingDomains) {
                    if (additionalDomain === effectiveNewHost)
                        continue; // Skip, already added above
                    summary.replacements.push({
                        oldHost: result.oldHost,
                        newHost: additionalDomain,
                        siteName: result.siteName,
                        startedHost: result.startedHost || "",
                        checkDurationMs: result.checkDurationMs,
                        patternChangedDomain,
                    });
                }
                // Update watcher on successful change
                // Always save only the hostname (domain), regardless of initial_domain format
                site.last_known_mirror = effectiveNewHost;
                site.last_seen = nowDateOnly;
                delete site.failed_days; // Reset on success
                delete site.failed_since;
                delete site.potentially_dead; // Remove flag on success
            }
            else {
                // Pattern change detected but check failed - requires manual review
                summary.failed++;
                // Log structured warning
                logger.warn(result.siteName, `⚠️ PATTERN CHANGE ALERT`);
                logger.warn(result.siteName, `   From: ${result.oldHost}`);
                logger.warn(result.siteName, `   To: ${result.newHost}`);
                logger.warn(result.siteName, `   Status: FAILED`);
                logger.warn(result.siteName, `   Action: Manual review required`);
                // Add to manual review list
                summary.warnings.push(`${result.siteName}: ${result.oldHost} → ${result.newHost}`);
                // Update watcher with failed status
                site.failed_since = nowFormatted;
                site.failed_days = calculateDaysSince(site.failed_since);
                site.potentially_dead = true;
            }
        }
        else {
            // Success but no change - update last_seen, reset failed_days
            summary.unchanged++;
            site.last_seen = nowDateOnly;
            delete site.failed_days;
            delete site.failed_since;
            delete site.potentially_dead; // Remove flag on success
        }
    }
    // Add replacements for initial_domain -> last_known_mirror if they differ
    // This ensures filters always use the current working mirror, even when no change occurred
    for (const result of results) {
        const site = watchers.sites[result.siteName];
        if (!site)
            continue;
        // Skip if failed or no last_known_mirror
        if (!site.last_known_mirror || site.potentially_dead)
            continue;
        // If the final resolved host matches last_known_mirror, nothing changed — skip
        if (result.newHost && result.newHost === site.last_known_mirror)
            continue;
        // Extract domain from initial_domain for comparison
        let initialDomain = site.initial_domain;
        if (initialDomain) {
            // Extract hostname from URL if initial_domain contains path
            if (initialDomain.includes('/')) {
                try {
                    const url = initialDomain.startsWith('http') ? initialDomain : `https://${initialDomain}`;
                    initialDomain = new URL(url).hostname;
                }
                catch {
                    // If URL parsing fails, try to extract domain manually
                    initialDomain = initialDomain.split('/')[0];
                }
            }
            // Extract hostname from last_known_mirror
            let lastKnownDomain = site.last_known_mirror;
            if (lastKnownDomain.includes('/')) {
                try {
                    const url = lastKnownDomain.startsWith('http') ? lastKnownDomain : `https://${lastKnownDomain}`;
                    lastKnownDomain = new URL(url).hostname;
                }
                catch {
                    lastKnownDomain = lastKnownDomain.split('/')[0];
                }
            }
            // Add replacement if domains differ and not already in replacements
            if (initialDomain !== lastKnownDomain) {
                const alreadyExists = summary.replacements.some(r => r.siteName === result.siteName && r.oldHost === initialDomain);
                if (!alreadyExists) {
                    summary.replacements.push({
                        oldHost: initialDomain,
                        newHost: lastKnownDomain,
                        siteName: result.siteName,
                        startedHost: result.startedHost || initialDomain,
                        checkDurationMs: result.checkDurationMs,
                    });
                }
            }
        }
    }
    // Apply replacements first (to show table before summary)
    const replacer = new FilterReplacer(config, logger, isTestMode);
    const replacerStats = await replacer.applyReplacements(summary.replacements, dryRun, originalLastKnownMirrors);
    // Determine whether there are any real changes to create a PR/commit for.
    // A real change means the domain actually changed from what was in watcher BEFORE processing.
    // If newHost === original last_known_mirror, it's not a change — just entry point resolution.
    const hasUniqueDomainChanges = (() => {
        const primaryBySite = new Map();
        for (const r of summary.replacements) {
            if (!primaryBySite.has(r.siteName)) {
                primaryBySite.set(r.siteName, r);
            }
        }
        return [...primaryBySite.values()].some(r => {
            // If newHost matches the original last_known_mirror, no real change occurred
            const originalMirror = originalLastKnownMirrors.get(r.siteName);
            if (originalMirror && r.newHost === originalMirror)
                return false;
            const fromHost = r.startedHost || r.oldHost;
            return fromHost !== r.newHost;
        });
    })();
    const hasRealChanges = hasUniqueDomainChanges || replacerStats.totalLineEdits > 0;
    // Print summary with detailed breakdown
    logger.logGlobal(LogLevel.RAW, "⬇️ ⬇️ ⬇️  ---=== Domains rotating summary ===---  ⬇️ ⬇️ ⬇️");
    logger.logGlobal(LogLevel.RAW, `  Total sites: ${summary.totalSites}`);
    logger.logGlobal(LogLevel.RAW, `  ├─ Checked sites: ${summary.checked}`);
    logger.logGlobal(LogLevel.RAW, `  ├─ Updated sites: ${summary.updated}`);
    if (summary.antibotAccepted > 0) {
        logger.logGlobal(LogLevel.RAW, `  ├─ Antibot accepted: ${summary.antibotAccepted} (not in failed count)`);
    }
    // When no domain changes detected, unchanged includes failed sites
    const actualUnchangedDisplay = summary.updated === 0 ? summary.checked - summary.updated : summary.unchanged;
    logger.logGlobal(LogLevel.RAW, `  └─ Unchanged sites: ${actualUnchangedDisplay}`);
    logger.logGlobal(LogLevel.RAW, ` 🚨  Failed: ${summary.failed}`);
    if (summary.antibotBlocked > 0) {
        logger.logGlobal(LogLevel.RAW, `  ├─ including antibot blocked: ${summary.antibotBlocked}`);
    }
    const networkErrors = summary.failed - summary.antibotBlocked;
    if (networkErrors > 0) {
        logger.logGlobal(LogLevel.RAW, `  └─ Network problems or dead: ${networkErrors}`);
    }
    // Display detailed errors and warnings
    logger.logGlobal(LogLevel.RAW, "");
    logger.logGlobal(LogLevel.RAW, "Problems:");
    const realErrors = summary.errors.filter(e => e.type !== 'antibot_accepted');
    if (realErrors.length > 0) {
        logger.logGlobal(LogLevel.RAW, " 🚨 Errors (no replacements made):");
        for (const { siteName, error, domain, checkDurationMs } of realErrors) {
            const domainInfo = domain ? ` [${domain}]` : '';
            const timeInfo = checkDurationMs ? ` (${(checkDurationMs / 1000).toFixed(2)}s)` : '';
            logger.logGlobal(LogLevel.RAW, `     - ${siteName}${domainInfo}: ${error}${timeInfo}`);
        }
    }
    // Separate pattern changes from other warnings
    const patternChanges = summary.warnings.filter(w => w.includes('→'));
    const otherWarnings = summary.warnings.filter(w => !w.includes('→'));
    if (patternChanges.length > 0) {
        logger.logGlobal(LogLevel.WARN, " ⚠️  Pattern changes requiring manual review:");
        for (const warning of patternChanges) {
            logger.logGlobal(LogLevel.WARN, `     ${warning}`);
        }
    }
    if (otherWarnings.length > 0) {
        logger.logGlobal(LogLevel.RAW, " ⚠️  Warnings:");
        for (const warning of otherWarnings) {
            logger.logGlobal(LogLevel.RAW, `     - ${warning}`);
        }
    }
    logger.logGlobal(LogLevel.RAW, "");
    logger.logGlobal(LogLevel.RAW, `Total phase time: ${batchSeconds}s`);
    // Verification: display formula and check counts
    // When no domain changes detected, unchanged includes failed sites
    const actualUnchanged = actualUnchangedDisplay;
    logger.logGlobal(LogLevel.DEBUG, `Checks number verification: ${summary.updated} + ${actualUnchanged} = ${summary.checked}`);
    const expectedTotal = summary.updated + summary.unchanged + summary.failed;
    if (expectedTotal !== summary.checked) {
        const missing = summary.checked - expectedTotal;
        logger.logGlobal(LogLevel.WARN, `⚠️ Summary count mismatch: checked=${summary.checked}, but updated+unchanged+failed=${expectedTotal}`);
        logger.logGlobal(LogLevel.DEBUG, `DEBUG: updated=${summary.updated}, unchanged=${summary.unchanged}, failed=${summary.failed}, antibotAccepted=${summary.antibotAccepted} (included), missing=${missing}`);
    }
    // List unchanged sites
    if (summary.unchanged > 0 || summary.updated === 0) {
        const unchangedHosts = [];
        for (const result of results) {
            const site = watchers.sites[result.siteName];
            if (!site)
                continue;
            // Include all sites that didn't change domain (regardless of success/failure)
            if (!result.hostChanged) {
                unchangedHosts.push(result.newHost);
            }
        }
        const filteredHosts = unchangedHosts.filter(host => host && host.trim() !== '');
        logger.logGlobal(LogLevel.RAW, ``);
        logger.logGlobal(LogLevel.RAW, `Unchanged sites:\n                        ${filteredHosts.join(', ')}`);
    }
    logger.logRaw("");
    // Display replacer summary
    logger.logGlobal(LogLevel.RAW, "=== Domains replacement summary ===");
    if (dryRun) {
        logger.logGlobal(LogLevel.INFO, "💡  DRY RUN MODE - No files were modified  💡");
    }
    logger.logGlobal(LogLevel.RAW, `Files scanned: ${replacerStats.filesScanned}`);
    logger.logGlobal(LogLevel.RAW, `Files modified: ${replacerStats.filesModified}${dryRun ? " (DRY RUN)" : ""}`);
    logger.logGlobal(LogLevel.RAW, `Total line edits: ${replacerStats.totalLineEdits}${dryRun ? " (DRY RUN)" : ""}`);
    logger.logGlobal(LogLevel.RAW, `Total phase time: ${replacerStats.replacerSeconds}s`);
    logger.logGlobal(LogLevel.RAW, "⬆️ ⬆️ ⬆️  ---=== Domains rotating summary ===---  ⬆️ ⬆️ ⬆️");
    logger.logRaw("");
    // Save updated watchers
    if (!dryRun) {
        saveWatchers(watchers);
        logger.logGlobal(LogLevel.INFO, "Watchers updated.\n");
    }
    // Force abort any remaining HTTP requests to prevent timeout logs
    resolver.abortAllRequests();
    // Stop diagnostics BEFORE final timing to avoid race conditions
    connectionDiagnostics.stop();
    // Wait a moment for any pending connection error logs to flush
    await new Promise(resolve => setTimeout(resolve, 100));
    // Calculate and display total execution time
    const totalDuration = Date.now() - startTime.getTime();
    const totalSeconds = (totalDuration / 1000).toFixed(3);
    logger.logRaw("");
    logger.logGlobal(LogLevel.RAW, `⌛ Total execution time: ${totalSeconds}s`);
    // Create git manager
    const gitManager = new GitManager(config, logger);
    // Determine skip reason BEFORE displaying PR info
    const skipReason = (() => {
        if (isTestMode && !dryRun)
            return "test mode (files were modified locally)";
        if (!hasRealChanges)
            return "no filter changes (all domains already up to date)";
        return null;
    })();
    // Display PR/Commit mode information only when there are real changes
    if (!skipReason) {
        const prModeInfo = gitManager.getPRModeInfo(summary, dryRun);
        if (prModeInfo.length > 0) {
            logger.logRaw("");
            prModeInfo.forEach(line => {
                logger.logRaw(line);
            });
        }
    }
    // Execute git operations (will include the log file in commit)
    let gitResult = {};
    if (skipReason) {
        logger.logGlobal(LogLevel.INFO, `Skipping PR/commit — ${skipReason}`);
    }
    else {
        // prod_live, prod_dry, test_dry: save logs and execute git
        logger.saveToFile();
        gitResult = await gitManager.commitOrCreatePR(summary, dryRun);
    }
    // Set GitHub Actions outputs
    if (process.env.GITHUB_ACTIONS && process.env.GITHUB_OUTPUT) {
        // Write to GITHUB_OUTPUT file (replaces deprecated set-output)
        (0,external_fs_namespaceObject.appendFileSync)(process.env.GITHUB_OUTPUT, `updated-count=${summary.replacements.length}\n`);
        if (gitResult.commitSha) {
            (0,external_fs_namespaceObject.appendFileSync)(process.env.GITHUB_OUTPUT, `commit-sha=${gitResult.commitSha}\n`);
        }
        if (gitResult.prNumber) {
            (0,external_fs_namespaceObject.appendFileSync)(process.env.GITHUB_OUTPUT, `pr-number=${gitResult.prNumber}\n`);
        }
    }
    logger.logGlobal(LogLevel.INFO, "✅ Done.");
}
// Only run main() when executed directly, not when imported for testing
if (!process.env.JEST_WORKER_ID) {
    main().catch((err) => {
        console.error("Fatal error:", err);
        process.exit(1);
    });
}

var __webpack_exports__naturalCompare = __webpack_exports__.p;
var __webpack_exports__selectFirstByOrder = __webpack_exports__.a;
export { __webpack_exports__naturalCompare as naturalCompare, __webpack_exports__selectFirstByOrder as selectFirstByOrder };
