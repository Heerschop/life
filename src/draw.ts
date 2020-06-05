import { ITreeNode, IBounds, IPoint } from "./life";

export interface IGridNode {
  x: number,
  y: number,
  node: ITreeNode,
}

export interface IGridNodes {
  root: ITreeNode;
  id: Set<number>;
  level: Set<number>;
  population: Set<number>;
  size: Set<number>;
  nodes: IGridNode[];
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

  public drawNodeGrid(nodes: IGridNode[]): void {
    const hash: Map<number, { x: number, y: number, count: number }> = new Map<number, { x: number, y: number, count: number }>();
    let width = Math.ceil(this.cell_width) - (this.cell_width * this.border_width | 0);

    for (const node of nodes) {
      let color = '#000070';
      const x = node.x + this.canvas_offset_x | 0;
      const y = node.y + this.canvas_offset_y | 0;
      const pointer = x + y * this.canvas_width;

      const value = hash.get(pointer) || { x: x, y: y, count: 0 };
      value.count++;
      hash.set(pointer, value)

      if (node.node.id === 3) {
        if (node.node.id === 3) color = '#700000';  // false leaf
        // if (node.node.id === 2) color = '#cccccc';  // true  leaf

        this.context.fillStyle = color;
        this.context.fillRect(x, y, width, width);
      }
    }

    for (const node of nodes) {
      let color = '#000070';

      if (node.node.id > 3) {
        const x = node.x + this.canvas_offset_x | 0;
        const y = node.y + this.canvas_offset_y | 0;
        const pointer = x + y * this.canvas_width;

        this.context.fillStyle = color;
        this.context.fillRect(x, y, width, width);
      }
    }

    for (const node of nodes) {
      let color = '#000070';
      const x = node.x + this.canvas_offset_x | 0;
      const y = node.y + this.canvas_offset_y | 0;
      const pointer = x + y * this.canvas_width;

      // const value = (hash.get(pointer) || 0) + 1;
      // hash.set(pointer, value)

      if (node.node.id === 2) {
        // if (node.node.id === 3) color = '#700000';  // false leaf
        if (node.node.id === 2) color = '#cccccc';  // true  leaf

        this.context.fillStyle = color;
        this.context.fillRect(x, y, width, width);
      }
    }

    if (width >= 24) {
      let fontSize = width / 1.7;

      this.context.font = fontSize + 'px Georgia';
      this.context.fillStyle = '#ffffff';
      this.context.textAlign = 'center';
      this.context.shadowOffsetX = 1;
      this.context.shadowOffsetY = 1;
      this.context.shadowBlur = 1;
      this.context.shadowColor = 'rgba(0,0,0,1)';
      this.context.textAlign = 'center';
      this.context.textBaseline = 'middle';

      for (const item of hash.values()) {
        this.context.fillText(item.count.toString(), item.x + width / 2, item.y + width / 2, 100);
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

    if (debug) {
      const gridNodes = this.getGridNodes(node);

      this.context.clearRect(0, 0, this.canvas_width, this.canvas_height);

      this.drawNodeGrid(gridNodes.nodes);

    } else {
      const count = this.canvas_width * this.canvas_height;

      for (let i = 0; i < count; i++) {
        this.image_data_data[i] = this.background_color;
      }

      const size = Math.pow(2, node.level - 1) * this.cell_width;

      this.draw_node(node, 2 * size, -size, -size);

      this.context.putImageData(this.image_data, 0, 0);
    }
  }

  private getGridNodes(node: ITreeNode): IGridNodes {
    const gridNodes: IGridNodes = {
      root: node,
      id: new Set<number>(),
      level: new Set<number>(),
      population: new Set<number>(),
      size: new Set<number>(),
      nodes: []
    };

    const size = Math.pow(2, node.level - 1) * this.cell_width;
    const left = -size;
    const top = -size;

    return LifeCanvasDrawer.traverseGridNodes(node, gridNodes, size * 2, left, top);
  }

  private static traverseGridNodes(node: ITreeNode, gridNodes: IGridNodes, size: number, left: number, top: number): IGridNodes {
    if (node) {
      gridNodes.id.add(node.id);
      gridNodes.level.add(node.level);
      gridNodes.population.add(node.population);
      gridNodes.size.add(size);
      gridNodes.nodes.push(
        {
          x: left,
          y: top,
          node: node
        }
      );

      size /= 2;

      LifeCanvasDrawer.traverseGridNodes(node.nw, gridNodes, size, left, top);
      LifeCanvasDrawer.traverseGridNodes(node.ne, gridNodes, size, left + size, top);
      LifeCanvasDrawer.traverseGridNodes(node.sw, gridNodes, size, left, top + size);
      LifeCanvasDrawer.traverseGridNodes(node.se, gridNodes, size, left + size, top + size);
    }

    return gridNodes;
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
