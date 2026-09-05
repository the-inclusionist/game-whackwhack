// SPDX-License-Identifier: AGPL-3.0-or-later
// Ambient types for `zdog` 1.1.3, which ships none.
//
// ========================= THE MINIMAL SLICE, NOT THE WHOLE LIBRARY =========================
// This is deliberately narrow: it declares what this game actually uses and nothing more, which
// is the same rule `core/contract` states for the engine — "declare the minimal slice you need,
// with Pick, rather than receiving the fat interface". A hand-written declaration also documents
// the dependency surface: if something new appears here, that is a real widening of what we lean
// on, and it should be a visible one.
//
// Written against the unminified `dist/zdog.dist.js` of 1.1.3, not from memory. Two things in
// here are load-bearing and easy to get wrong:
//
//  · `pathCommands[i].endRenderPoint` is where the PROJECTED corner of a shape ends up after
//    `updateGraph()`. Picking reads it. It is undocumented on zzz.dog but stable in the source.
//  · `sortValue` is the mean z of those points. Zdog sorts `flatGraph` ASCENDING and renders in
//    that order, so a higher value was drawn later and is NEARER the viewer.

declare module 'zdog' {
  export interface VectorLike {
    x?: number;
    y?: number;
    z?: number;
  }

  export class Vector {
    constructor(option?: VectorLike);
    x: number;
    y: number;
    z: number;
    set(v: VectorLike): this;
    copy(v: VectorLike): this;
    add(v: VectorLike): this;
    subtract(v: VectorLike): this;
    multiply(v: VectorLike | number): this;
    rotate(rotation: VectorLike): this;
  }

  export interface AnchorOptions {
    addTo?: Anchor;
    translate?: VectorLike;
    rotate?: VectorLike;
    scale?: VectorLike | number;
  }

  export class Anchor {
    constructor(options?: AnchorOptions);
    translate: Vector;
    rotate: Vector;
    scale: Vector;
    children: Anchor[];
    /** Every renderable in the subtree, depth-sorted after `updateGraph()`. */
    flatGraph: Anchor[];
    /** Mean z of the shape's projected points. Higher = nearer the viewer. */
    sortValue: number;
    addChild(child: Anchor): void;
    removeChild(child: Anchor): void;
    remove(): void;
    /** Applies transforms and re-sorts. Must run before projected points are read. */
    updateGraph(): void;
    renderGraphCanvas(ctx: CanvasRenderingContext2D): void;
  }

  /** One segment of a shape's path. `endRenderPoint` is its PROJECTED endpoint. */
  export interface PathCommand {
    endRenderPoint: Vector;
    renderPoints: Vector[];
  }

  export interface ShapeOptions extends AnchorOptions {
    color?: string;
    /** Line width, or `false` for no stroke. A single-point Shape with a stroke renders as a disc. */
    stroke?: number | false;
    fill?: boolean;
    visible?: boolean;
    backface?: boolean | string;
    front?: VectorLike;
    path?: VectorLike[];
  }

  export class Shape extends Anchor {
    constructor(options?: ShapeOptions);
    color: string;
    stroke: number | false;
    fill: boolean;
    visible: boolean;
    /** Populated by `updateGraph()`. The four corners of a Rect live here. */
    pathCommands: PathCommand[];
  }

  export interface RectOptions extends ShapeOptions {
    width?: number;
    height?: number;
  }

  export class Rect extends Shape {
    constructor(options?: RectOptions);
    width: number;
    height: number;
  }

  export interface EllipseOptions extends ShapeOptions {
    diameter?: number;
    width?: number;
    height?: number;
    /** How many quarter-arcs to draw. 4 is a full ellipse. */
    quarters?: number;
  }

  export class Ellipse extends Shape {
    constructor(options?: EllipseOptions);
    diameter: number;
  }

  /**
   * A dome: the curved half plus its flat elliptical base, drawn as two paths.
   *
   * It carries its own `updateSortValue` — the centroid sits 3/8 of the way from the origin to
   * the apex rather than at the mean of the path points — which is what lets two of them, apex up
   * and apex down, sort against each other and against everything else as a single ball would.
   */
  export class Hemisphere extends Ellipse {
    constructor(options?: EllipseOptions);
  }

  export interface BoxOptions extends AnchorOptions {
    width?: number;
    height?: number;
    depth?: number;
    color?: string;
    stroke?: number | false;
    fill?: boolean;
    visible?: boolean;
    frontFace?: string | false;
    rearFace?: string | false;
    leftFace?: string | false;
    rightFace?: string | false;
    topFace?: string | false;
    bottomFace?: string | false;
  }

  /** Six Rect faces under one Anchor — not a Shape itself. */
  export class Box extends Anchor {
    constructor(options?: BoxOptions);
    color: string;
    stroke: number | false;
  }

  export interface IllustrationOptions extends AnchorOptions {
    element: HTMLCanvasElement | SVGElement | string;
    zoom?: number;
    centered?: boolean;
    dragRotate?: boolean | Anchor;
    resize?: boolean | 'fullscreen';
    onPrerender?(ctx: CanvasRenderingContext2D): void;
  }

  export class Illustration extends Anchor {
    constructor(options: IllustrationOptions);
    element: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;
    zoom: number;
    /**
     * ⚠️ Defaults to `devicePixelRatio`, AND `setSize` re-reads `window.devicePixelRatio` and
     * overwrites this — so assigning 1 before calling `setSize` accomplishes nothing. Call
     * `setSize` first, then force this to 1 and repair `canvasWidth`/`canvasHeight` and the
     * element's own attributes, or the backing store silently comes out several times too large
     * on any HiDPI screen. See render/zdog-stage and tests/canvas.browser.test.ts.
     */
    pixelRatio: number;
    /**
     * The backing-store size Zdog computed, in device pixels. `prerenderCanvas` clears against
     * these, so leaving them at `width * devicePixelRatio` while the element is 640 wide clears
     * an area larger than the canvas — harmless, but it means these are part of the invariant
     * and have to be repaired alongside `pixelRatio`.
     */
    canvasWidth: number;
    canvasHeight: number;
    centered: boolean;
    setSize(width: number, height: number): void;
    updateRenderGraph(item?: Anchor): void;
    prerenderCanvas(): void;
    postrenderCanvas(): void;

    // NOT declared: `renderGraphCanvas`. Zdog overrides Anchor's version with an INCOMPATIBLE
    // signature — Anchor takes a canvas context, Illustration takes an optional item and supplies
    // its own context — so declaring both makes Illustration unassignable to Anchor, which breaks
    // `addTo`. We never call it on an Illustration; `updateRenderGraph()` is the entry point.
  }

  export const TAU: number;

  const Zdog: {
    TAU: number;
    Vector: typeof Vector;
    Anchor: typeof Anchor;
    Shape: typeof Shape;
    Rect: typeof Rect;
    Ellipse: typeof Ellipse;
    Hemisphere: typeof Hemisphere;
    Box: typeof Box;
    Illustration: typeof Illustration;
  };

  export default Zdog;
}
