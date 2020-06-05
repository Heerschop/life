import { ITreeNode, IBounds, IPoint } from "./life";

interface IGridCell {
  x: number,
  y: number,
  type: 'Dead leaf' | 'Live leaf' | 'Node' | '',
  nodes: ITreeNode[]
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

  private pixel_ratio = 1;

  private cell_color = 0xffcccccc; //Alpha Blue Green Red (ABGR)
  private background_color = 0xff000000; //Alpha Blue Green Red (ABGR)

  // given as ratio of cell size
  public border_width = 0;
  public cell_width = 2;

  constructor(public readonly canvas: HTMLCanvasElement, width: number, height: number) {
    const context = this.canvas.getContext("2d");

    if (!this.canvas.getContext || !context) {
      throw new Error('Canvas-less browsers are not supported.');
    }

    this.context = context;

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

  public static getIntensityColor(intensity: number): number {
    intensity += 100;

    if (intensity < 100) intensity = 100;

    let r = Math.round(intensity / 2);
    let g = Math.round(intensity / 4);
    let b = Math.round(intensity / 6);

    if (r > 255) r = 255;
    if (g > 255) g = 255;
    if (b > 255) b = 255;

    return r | g << 8 | b << 16 | 0xFF << 24;
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
        this.fill_square(left + this.canvas_offset_x | 0, top + this.canvas_offset_y | 0, 1, this.cell_color);
      }
    }
    else if (node.level === 0) {
      if (node.population) {
        this.fill_square(left + this.canvas_offset_x, top + this.canvas_offset_y, this.cell_width, this.cell_color);
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

  private fill_square(x: number, y: number, size: number, color: number): void {
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

    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        this.image_data_data[pointer] = color;

        pointer++;
      }
      pointer += row_width;
    }
  }

  public redraw(node: ITreeNode, debug: boolean): void {
    this._border_width = this.border_width * this.cell_width | 0;

    const size = Math.pow(2, node.level - 1) * this.cell_width;

    if (debug) {
      this.context.clearRect(0, 0, this.canvas_width, this.canvas_height);

      const cells = this.draw_cells(node, 2 * size, -size, -size);

      this.draw_text(cells);

    } else {
      const count = this.canvas_width * this.canvas_height;

      for (let i = 0; i < count; i++) {
        this.image_data_data[i] = this.background_color;
      }

      this.draw_node(node, 2 * size, -size, -size);

      this.context.putImageData(this.image_data, 0, 0);
    }
  }

  private draw_text(cells: Map<number, IGridCell>) {
    const cellSize = Math.ceil(this.cell_width) - (this.cell_width * this.border_width | 0);

    if (cellSize >= 24) {
      this.context.fillStyle = '#ffffff';
      this.context.textAlign = 'center';
      this.context.shadowOffsetX = 1;
      this.context.shadowOffsetY = 1;
      this.context.shadowBlur = 1;
      this.context.shadowColor = 'rgba(0,0,0,1)';

      if (cellSize < 384) {
        let fontSize = cellSize / 1.7;

        this.context.font = fontSize + 'px Consolas';
        this.context.textAlign = 'center';
        this.context.textBaseline = 'middle';

        for (const item of cells.values()) {
          this.context.fillText(item.nodes.length.toString(), item.x + cellSize / 2, item.y + cellSize / 2);
        }
      } else {
        let fontSize = cellSize / 28;
        let rowSpace = cellSize / 20;

        this.context.font = fontSize + 'px Consolas';
        this.context.textAlign = 'left';
        this.context.textBaseline = 'middle';

        for (const item of cells.values()) {
          let row = 12;
          let column = 12;

          this.context.fillText('Nodes: ' + item.nodes.length.toString(), item.x + column, item.y + row);

          for (const node of item.nodes) {
            row += rowSpace;
            this.context.fillText('type: ' + node.constructor.name.toString(), item.x + column, item.y + (row += rowSpace));
            this.context.fillText('id: ' + node.id.toString(), item.x + column, item.y + (row += rowSpace));
            this.context.fillText('level: ' + node.level.toString(), item.x + column, item.y + (row += rowSpace));
            this.context.fillText('population: ' + node.population.toString(), item.x + column, item.y + (row += rowSpace));

            if (row > (cellSize / 1.5)) {
              row = 12;
              column += cellSize / 2.5;
            }
          }


        }

      }
    }
  }

  private draw_cells(node: ITreeNode, size: number, left: number, top: number, cells = new Map<number, IGridCell>()): Map<number, IGridCell> {
    if (node) {
      let cellSize = Math.ceil(this.cell_width) - (this.cell_width * this.border_width | 0);

      const x = left + this.canvas_offset_x | 0;
      const y = top + this.canvas_offset_y | 0;
      const pointer = x + y * this.canvas_width;

      let cell = cells.get(pointer);

      if (cell === undefined) {
        cell = { x: x, y: y, type: '', nodes: [] };
        cells.set(pointer, cell)
      }

      cell.nodes.push(node);

      size /= 2;

      this.draw_cells(node.nw, size, left, top, cells);
      this.draw_cells(node.ne, size, left + size, top, cells);
      this.draw_cells(node.sw, size, left, top + size, cells);
      this.draw_cells(node.se, size, left + size, top + size, cells);

      if (cell.type === 'Live leaf') return cells;
      if (cell.type === 'Node') return cells;

      cell.type = 'Node';

      let color = '#000070';

      if (node.id === 3) {
        cell.type = 'Dead leaf';
        color = '#700000';  // false leaf
      }
      if (node.id === 2) {
        cell.type = 'Live leaf';
        color = '#cccccc';  // true  leaf
      }

      if (x + cellSize < 0 || y + cellSize < 0 || x >= this.canvas_width || y >= this.canvas_height) return cells;

      this.context.fillStyle = color;
      this.context.fillRect(x, y, cellSize, cellSize);
    }

    return cells;
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

  private static RGBAtoColor(rgba: number): string {
    return '#' +
      ((rgba >> 0x00) & 0xFF).toString(16).padStart(2, '0') +
      ((rgba >> 0x08) & 0xFF).toString(16).padStart(2, '0') +
      ((rgba >> 0x10) & 0xFF).toString(16).padStart(2, '0');
  }

  public draw_cell(x: number, y: number, set: boolean): void {
    let cell_x = x * this.cell_width + this.canvas_offset_x;
    let cell_y = y * this.cell_width + this.canvas_offset_y;
    let width = Math.ceil(this.cell_width) - (this.cell_width * this.border_width | 0);

    if (set) {
      this.context.fillStyle = LifeCanvasDrawer.RGBAtoColor(this.cell_color);
    }
    else {
      this.context.fillStyle = LifeCanvasDrawer.RGBAtoColor(this.background_color);
    }

    this.context.fillRect(cell_x, cell_y, width, width);
  }

  public pixel2cell(x: number, y: number): IPoint {
    return {
      x: Math.floor((x * this.pixel_ratio - this.canvas_offset_x + this.border_width / 2) / this.cell_width),
      y: Math.floor((y * this.pixel_ratio - this.canvas_offset_y + this.border_width / 2) / this.cell_width)
    };
  }
}
