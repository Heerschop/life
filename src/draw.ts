export class LifeCanvasDrawer {

  // where is the viewport in pixels, from 0,0
  private canvas_offset_x = 0;
  private canvas_offset_y = 0;

  private canvas_width = 0;
  private canvas_height = 0;

  // canvas contexts
  private canvas: any;
  private context: any;

  private image_data: any;
  private image_data_data: any;

  // in pixels
  private _border_width = 0;
  private cell_color_rgb: any;

  private pixel_ratio = 1;

  cell_color = null;
  background_color = null;

  // given as ratio of cell size
  border_width = 0;
  cell_width = 2;

  constructor() {
  }

  init(dom_parent: any) {
    this.canvas = document.createElement("canvas");

    if (!this.canvas.getContext) {
      return false;
    }

    this.canvas = this.canvas;

    this.context = this.canvas.getContext("2d");

    dom_parent.appendChild(this.canvas);

    return true;
  }

  set_size(width: number, height: number) {
    if (width !== this.canvas_width || height !== this.canvas_height) {
      if (true) {
        this.canvas.style.width = width + "px";
        this.canvas.style.height = height + "px";
        var factor = window.devicePixelRatio;
      }
      else {
        var factor = 1;
      }

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

      for (var i = 0; i < width * height; i++) {
        this.image_data_data[i] = 0xFF << 24;
      }
    }
  }

  draw_node(node: any, size: number, left: number, top: number) {
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

  fill_square(x: number, y: number, size: number) {
    var width = size - this._border_width,
      height = width;

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

    var pointer = x + y * this.canvas_width,
      row_width = this.canvas_width - width;

    //console.assert(x >= 0 && y >= 0 && x + width <= canvas_width && y + height <= canvas_height);
    var color = this.cell_color_rgb.r | this.cell_color_rgb.g << 8 | this.cell_color_rgb.b << 16 | 0xFF << 24;

    for (var i = 0; i < height; i++) {
      for (var j = 0; j < width; j++) {
        this.image_data_data[pointer] = color;

        pointer++;
      }
      pointer += row_width;
    }
  }


  redraw(node: any) {
    var bg_color_rgb = this.color2rgb(this.background_color);
    var bg_color_int = bg_color_rgb.r | bg_color_rgb.g << 8 | bg_color_rgb.b << 16 | 0xFF << 24;

    this._border_width = this.border_width * this.cell_width | 0;
    this.cell_color_rgb = this.color2rgb(this.cell_color);

    var count = this.canvas_width * this.canvas_height;

    for (var i = 0; i < count; i++) {
      this.image_data_data[i] = bg_color_int;
    }

    var size = Math.pow(2, node.level - 1) * this.cell_width;

    this.draw_node(node, 2 * size, -size, -size);

    this.context.putImageData(this.image_data, 0, 0);
  }

  /**
   * @param {number} center_x
   * @param {number} center_y
   */
  zoom(out: any, center_x: number, center_y: number) {
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
  zoom_at(out: any, center_x: number, center_y: number) {
    this.zoom(out, center_x * this.pixel_ratio, center_y * this.pixel_ratio);
  }

  zoom_centered(out: any) {
    this.zoom(out, this.canvas_width >> 1, this.canvas_height >> 1);
  }

  /*
   * set zoom to the given level, rounding down
   */
  zoom_to(level: number) {
    while (this.cell_width > level) {
      this.zoom_centered(true);
    }

    while (this.cell_width * 2 < level) {
      this.zoom_centered(false);
    }
  }

  center_view() {
    this.canvas_offset_x = this.canvas_width >> 1;
    this.canvas_offset_y = this.canvas_height >> 1;
  }

  move(dx: number, dy: number) {
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

  fit_bounds(bounds: any) {
    var width = bounds.right - bounds.left,
      height = bounds.bottom - bounds.top,
      relative_size,
      x,
      y;

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

  draw_cell(x: number, y: number, set: any) {
    var cell_x = x * this.cell_width + this.canvas_offset_x,
      cell_y = y * this.cell_width + this.canvas_offset_y,
      width = Math.ceil(this.cell_width) -
        (this.cell_width * this.border_width | 0);

    if (set) {
      this.context.fillStyle = this.cell_color;
    }
    else {
      this.context.fillStyle = this.background_color;
    }

    this.context.fillRect(cell_x, cell_y, width, width);
  }

  pixel2cell(x: number, y: number) {
    return {
      x: Math.floor((x * this.pixel_ratio - this.canvas_offset_x + this.border_width / 2) / this.cell_width),
      y: Math.floor((y * this.pixel_ratio - this.canvas_offset_y + this.border_width / 2) / this.cell_width)
    };
  }

  // #321 or #332211 to { r: 0x33, b: 0x22, g: 0x11 }
  color2rgb(color: any) {
    if (color.length === 4) {
      return {
        r: parseInt(color[1] + color[1], 16),
        g: parseInt(color[2] + color[2], 16),
        b: parseInt(color[3] + color[3], 16)
      };
    }
    else {
      return {
        r: parseInt(color.slice(1, 3), 16),
        g: parseInt(color.slice(3, 5), 16),
        b: parseInt(color.slice(5, 7), 16)
      };
    }
  }
}
