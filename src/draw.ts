import { ITreeNode, IBounds, IPoint } from "./life";

interface IColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export class LifeCanvasDrawer {

  // where is the viewport in pixels, from 0,0
  private canvas_offset_x = 0;
  private canvas_offset_y = 0;

  private canvas_width = 0;
  private canvas_height = 0;

  // canvas contexts
  private context: CanvasRenderingContext2D;

  private image_data!: ImageData;
  private image_data_data!: Int32Array;

  // in pixels
  private _border_width = 0;
  private cell_color_rgb: IColor = LifeCanvasDrawer.color2rgb('#cccccc');

  private pixel_ratio = 1;

  public cell_color = '#cccccc';
  public background_color = '#000000';

  // given as ratio of cell size
  public border_width = 0;
  public cell_width = 2;
  public readonly canvas: HTMLCanvasElement;

  constructor(dom_parent: HTMLElement, width: number, height: number) {
    this.canvas = document.createElement("canvas");

    const context = this.canvas.getContext("2d");

    if (!this.canvas.getContext || !context) {
      throw new Error('Canvas-less browsers are not supported.');
    }

    this.context = context;

    dom_parent.appendChild(this.canvas);

    this.set_size(width, height);
  }

  public set_size(width: number, height: number): void {
    if (width !== this.canvas_width || height !== this.canvas_height) {
      const factor = window.devicePixelRatio;

      this.canvas.style.width = width + "px";
      this.canvas.style.height = height + "px";

      this.pixel_ratio = factor;

      // Math.round is important here: Neither floor nor ceil produce
      // sharp pixels (test by taking a screenshot at 1:1 zoom and
      // inspecting in an image editor)
      this.canvas.width = Math.round(width * factor);
      this.canvas.height = Math.round(height * factor);

      this.canvas_width = this.canvas.width;
      this.canvas_height = this.canvas.height;

      this.image_data = this.context.createImageData(this.canvas_width, this.canvas_height);
      this.image_data_data = new Int32Array(this.image_data.data.buffer);

      for (let i = 0; i < width * height; i++) {
        this.image_data_data[i] = 0xFF << 24;
      }
    }
  }

  private draw_node(node: ITreeNode, size: number, left: number, top: number): void {
    if (node.population === 0) {
      return;
    }

    if (
      left + size + this.canvas_offset_x < 0 ||
      top + size + this.canvas_offset_y < 0 ||
      left + this.canvas_offset_x >= this.canvas_width ||
      top + this.canvas_offset_y >= this.canvas_height
    ) {
      // do not draw outside of the screen
      return;
    }

    if (size <= 1) {
      if (node.population) {
        this.fill_square(left + this.canvas_offset_x | 0, top + this.canvas_offset_y | 0, 1);
      }
    }
    else if (node.level === 0) {
      if (node.population) {
        this.fill_square(left + this.canvas_offset_x, top + this.canvas_offset_y, this.cell_width);
      }
    }
    else {
      size /= 2;

      this.draw_node(node.nw, size, left, top);
      this.draw_node(node.ne, size, left + size, top);
      this.draw_node(node.sw, size, left, top + size);
      this.draw_node(node.se, size, left + size, top + size);
    }
  }

  private fill_square(x: number, y: number, size: number): void {
    let width = size - this._border_width;
    let height = width;

    if (x < 0) {
      width += x;
      x = 0;
    }

    if (x + width > this.canvas_width) {
      width = this.canvas_width - x;
    }

    if (y < 0) {
      height += y;
      y = 0;
    }

    if (y + height > this.canvas_height) {
      height = this.canvas_height - y;
    }

    if (width <= 0 || height <= 0) {
      return;
    }

    let pointer = x + y * this.canvas_width;
    let row_width = this.canvas_width - width;

    //console.assert(x >= 0 && y >= 0 && x + width <= canvas_width && y + height <= canvas_height);
    const color = this.cell_color_rgb.r | this.cell_color_rgb.g << 8 | this.cell_color_rgb.b << 16 | 0xFF << 24;

    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        this.image_data_data[pointer] = color;

        pointer++;
      }
      pointer += row_width;
    }
  }

  public redraw(node: ITreeNode): void {
    const bg_color_rgb = LifeCanvasDrawer.color2rgb(this.background_color);
    const bg_color_int = bg_color_rgb.r | bg_color_rgb.g << 8 | bg_color_rgb.b << 16 | 0xFF << 24;

    this._border_width = this.border_width * this.cell_width | 0;
    this.cell_color_rgb = LifeCanvasDrawer.color2rgb(this.cell_color);

    const count = this.canvas_width * this.canvas_height;

    for (let i = 0; i < count; i++) {
      this.image_data_data[i] = bg_color_int;
    }

    const size = Math.pow(2, node.level - 1) * this.cell_width;

    this.draw_node(node, 2 * size, -size, -size);

    this.context.putImageData(this.image_data, 0, 0);
  }

  /**
   * @param {number} center_x
   * @param {number} center_y
   */
  private zoom(out: boolean, center_x: number, center_y: number): void {
    if (out) {
      this.canvas_offset_x -= Math.round((this.canvas_offset_x - center_x) / 2);
      this.canvas_offset_y -= Math.round((this.canvas_offset_y - center_y) / 2);

      this.cell_width /= 2;
    }
    else {
      this.canvas_offset_x += Math.round(this.canvas_offset_x - center_x);
      this.canvas_offset_y += Math.round(this.canvas_offset_y - center_y);

      this.cell_width *= 2;
    }
  }

  /**
   * @param {number} center_x
   * @param {number} center_y
   */
  public zoom_at(out: boolean, center_x: number, center_y: number): void {
    this.zoom(out, center_x * this.pixel_ratio, center_y * this.pixel_ratio);
  }

  public zoom_centered(out: boolean): void {
    this.zoom(out, this.canvas_width >> 1, this.canvas_height >> 1);
  }

  /*
   * set zoom to the given level, rounding down
   */
  private zoom_to(level: number): void {
    while (this.cell_width > level) {
      this.zoom_centered(true);
    }

    while (this.cell_width * 2 < level) {
      this.zoom_centered(false);
    }
  }

  public center_view(): void {
    this.canvas_offset_x = this.canvas_width >> 1;
    this.canvas_offset_y = this.canvas_height >> 1;
  }

  public move(dx: number, dy: number): void {
    this.canvas_offset_x += Math.round(dx * this.pixel_ratio);
    this.canvas_offset_y += Math.round(dy * this.pixel_ratio);

    // This code is faster for patterns with a huge density (for instance, spacefiller)
    // It causes jitter for all other patterns though, that's why the above version is preferred

    //context.drawImage(canvas, dx, dy);

    //if(dx < 0)
    //{
    //    redraw_part(node, canvas_width + dx, 0, -dx, canvas_height);
    //}
    //else if(dx > 0)
    //{
    //    redraw_part(node, 0, 0, dx, canvas_height);
    //}

    //if(dy < 0)
    //{
    //    redraw_part(node, 0, canvas_height + dy, canvas_width, -dy);
    //}
    //else if(dy > 0)
    //{
    //    redraw_part(node, 0, 0, canvas_width, dy);
    //}
  }

  public fit_bounds(bounds: IBounds): void {
    let width = bounds.right - bounds.left;
    let height = bounds.bottom - bounds.top;
    let relative_size: number;
    let x: number;
    let y: number;

    if (isFinite(width) && isFinite(height)) {
      relative_size = Math.min(
        16, // maximum cell size
        this.canvas_width / width, // relative width
        this.canvas_height / height // relative height
      );
      this.zoom_to(relative_size);

      x = Math.round(this.canvas_width / 2 - (bounds.left + width / 2) * this.cell_width);
      y = Math.round(this.canvas_height / 2 - (bounds.top + height / 2) * this.cell_width);
    }
    else {
      // can happen if the pattern is empty or very large
      this.zoom_to(16);

      x = this.canvas_width >> 1;
      y = this.canvas_height >> 1;
    }

    this.canvas_offset_x = x;
    this.canvas_offset_y = y;
  }

  public draw_cell(x: number, y: number, set: boolean): void {
    let cell_x = x * this.cell_width + this.canvas_offset_x;
    let cell_y = y * this.cell_width + this.canvas_offset_y;
    let width = Math.ceil(this.cell_width) - (this.cell_width * this.border_width | 0);

    if (set) {
      this.context.fillStyle = this.cell_color;
    }
    else {
      this.context.fillStyle = this.background_color;
    }

    this.context.fillRect(cell_x, cell_y, width, width);
  }

  public pixel2cell(x: number, y: number): IPoint {
    return {
      x: Math.floor((x * this.pixel_ratio - this.canvas_offset_x + this.border_width / 2) / this.cell_width),
      y: Math.floor((y * this.pixel_ratio - this.canvas_offset_y + this.border_width / 2) / this.cell_width)
    };
  }

  // #321 or #332211 to { r: 0x33, b: 0x22, g: 0x11 }
  private static color2rgb(color: string): IColor {
    if (color.length === 4) {
      return {
        r: parseInt(color[1] + color[1], 16),
        g: parseInt(color[2] + color[2], 16),
        b: parseInt(color[3] + color[3], 16)
      };
    }

    return {
      r: parseInt(color.slice(1, 3), 16),
      g: parseInt(color.slice(3, 5), 16),
      b: parseInt(color.slice(5, 7), 16)
    };
  }
}
