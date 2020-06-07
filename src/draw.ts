import { ITreeNode, IBounds, IPoint } from "./life";

interface IRelations {
  nw: IPoint | null;
  ne: IPoint | null;
  sw: IPoint | null;
  se: IPoint | null;
}

interface IGridCell {
  left: number;
  top: number;
  live: boolean;
  nodes: Array<ITreeNode & { type: string, size: number }>;
}

class RootNode implements ITreeNode {
  public readonly objectId: number;
  public readonly level: number;
  public readonly population: number;
  public readonly cache: ITreeNode | null;
  public readonly quick_cache: ITreeNode | null;
  public readonly hashmap_next: ITreeNode | undefined;
  public readonly nw: ITreeNode;
  public readonly ne: ITreeNode;
  public readonly sw: ITreeNode;
  public readonly se: ITreeNode;
  public readonly id: number;

  constructor(node: ITreeNode) {
    this.objectId = node.objectId;
    this.level = node.level;
    this.population = node.population;
    this.cache = node.cache;
    this.quick_cache = node.quick_cache;
    this.hashmap_next = node.hashmap_next;
    this.nw = node.nw;
    this.ne = node.ne;
    this.sw = node.sw;
    this.se = node.se;
    this.id = node.id;
  }
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

  public redraw(node: ITreeNode): void {
    this._border_width = this.border_width * this.cell_width | 0;

    const size = Math.pow(2, node.level - 1) * this.cell_width;
    const count = this.canvas_width * this.canvas_height;

    for (let i = 0; i < count; i++) {
      this.image_data_data[i] = this.background_color;
    }

    this.draw_node(node, 2 * size, -size, -size);

    this.context.putImageData(this.image_data, 0, 0);
  }

  public redraw_debug(node: ITreeNode): void {
    this._border_width = this.border_width * this.cell_width | 0;

    this.context.clearRect(0, 0, this.canvas_width, this.canvas_height);

    const cells = this.get_grid_cells(new RootNode(node));

    this.draw_cells(cells);
  }

  public get_grid_cells(node: ITreeNode): IterableIterator<IGridCell> {
    const cells = new Map<number, IGridCell>()
    const size = Math.pow(2, node.level - 1);

    LifeCanvasDrawer.collect_grid_cells(node, size * 2, 2 * size, -size, -size, cells);

    return cells.values();
  }

  private static collect_grid_cells(node: ITreeNode, width: number, size: number, left: number, top: number, cells: Map<number, IGridCell>): void {
    if (node) {
      const pointer = left + top * width;

      let cell = cells.get(pointer);

      if (cell === undefined) {
        cell = { left: left, top: top, live: false, nodes: [] };
        cells.set(pointer, cell)
      }

      const relations: IRelations = {
        nw: null,
        ne: null,
        sw: null,
        se: null,
      }

      size /= 2;

      cell.nodes.push({
        ...node,
        type: node.constructor.name,
        size: size
      });

      if (node.nw) relations.nw = { x: left, y: top };
      if (node.ne) relations.ne = { x: left + size, y: top };
      if (node.sw) relations.sw = { x: left, y: top + size };
      if (node.se) relations.se = { x: left + size, y: top + size };

      this.collect_grid_cells(node.nw, width, size, left, top, cells);
      this.collect_grid_cells(node.ne, width, size, left + size, top, cells);
      this.collect_grid_cells(node.sw, width, size, left, top + size, cells);
      this.collect_grid_cells(node.se, width, size, left + size, top + size, cells);
    }
  }

  private getCellColor(nodes: ITreeNode[]): string {
    let color = '#700000';

    for (const node of nodes) {
      if (node.id === 2) return '#cccccc';
      if (node.id !== 3) color = '#000070';
    }

    return color;
  }

  public draw_cells(cells: IterableIterator<IGridCell>) {
    const cellBorder = (this.cell_width * this.border_width | 0);
    const cellSize = Math.ceil(this.cell_width) - cellBorder;
    const canvasX = this.canvas_offset_x;
    const canvasY = this.canvas_offset_y;

    const fontSize = cellSize / 29;
    const nodeOffsetTop = cellSize / 20;
    const nodeWidth = cellSize / 3.95;
    const nodeHeight = cellSize / 4.5;
    const nodeHorzBorder = (cellSize - (nodeWidth * 3)) / 4;
    const nodeVertBorder = (cellSize - nodeOffsetTop - (nodeHeight * 3)) / 4;

    this.context.shadowOffsetX = 1;
    this.context.shadowOffsetY = 1;
    this.context.shadowBlur = 1;
    this.context.shadowColor = 'rgba(0,0,0,1)';

    for (const cell of cells) {
      const cellX = cell.left * (cellSize + cellBorder) + canvasX;
      const cellY = cell.top * (cellSize + cellBorder) + canvasY;

      this.context.fillStyle = this.getCellColor(cell.nodes);//'#800000';
      this.context.fillRect(cellX, cellY, cellSize, cellSize);

      this.context.fillStyle = '#ffffff';

      if (cellSize >= 300) {
        this.context.font = 'bold ' + fontSize * 1.7 + 'px sans-serif';

        this.context.textAlign = 'center';
        this.context.textBaseline = 'middle';
        this.context.fillText(cell.left + ' , ' + cell.top, cellX + cellSize / 2, cellY + nodeOffsetTop * 1.2);
      }

      let nodeX = nodeHorzBorder;
      let nodeY = nodeVertBorder + nodeOffsetTop;

      this.context.strokeStyle = '#ffffff';

      if (cellSize >= 75) {
        for (let index = 0; index < 1; index++) {
          for (const node of cell.nodes) {
            this.drawNode(node, cellX + nodeX, cellY + nodeY, nodeWidth, nodeHeight, fontSize);

            nodeY += nodeHeight + nodeVertBorder;
            if (nodeY >= cellSize) {
              nodeY = nodeVertBorder + nodeOffsetTop;
              nodeX += nodeWidth + nodeHorzBorder;
            }
          }
        }
      } else {
        this.context.font = 'bold ' + fontSize * 14 + 'px sans-serif';
        this.context.textAlign = 'center';
        this.context.textBaseline = 'middle';

        this.context.fillText(cell.nodes.length.toString(), cellX + cellSize / 2, cellY + cellSize / 2 + cellSize / 25);
      }
    }
  }

  private drawNode(node: ITreeNode, x: number, y: number, width: number, height: number, fontSize: number) {
    this.context.fillStyle = 'rgba(255,255,255,0.4)';
    this.context.fillRect(x, y, width, height);

    this.context.beginPath();
    this.context.arc(x, y, width / 12, 0, 2 * Math.PI);
    this.context.fill();

    this.context.beginPath();
    this.context.arc(x + width, y, width / 12, 0, 2 * Math.PI);
    this.context.fill();

    this.context.beginPath();
    this.context.arc(x + width, y + height, width / 12, 0, 2 * Math.PI);
    this.context.fill();

    this.context.beginPath();
    this.context.arc(x, y + height, width / 12, 0, 2 * Math.PI);
    this.context.fill();

    this.context.fillStyle = '#ffffff';
    this.context.textAlign = 'center';
    this.context.textBaseline = 'middle';

    if (width > 75) {
      this.context.font = 'bold ' + fontSize * 0.7 + 'px sans-serif';

      const offset = height / 120;
      if (node.nw) this.context.fillText(node.nw.objectId.toString(), x, y + offset);
      if (node.ne) this.context.fillText(node.ne.objectId.toString(), x + width, y + offset);
      if (node.se) this.context.fillText(node.se.objectId.toString(), x + width, y + height + offset);
      if (node.sw) this.context.fillText(node.sw.objectId.toString(), x, y + height + offset);

      const rowSpace = height / 7.7;
      const maring = width / 10;

      y += rowSpace * 1.4;

      this.context.textAlign = 'left';
      this.context.font = 'bold ' + fontSize * 0.9 + 'px sans-serif';
      this.context.fillText((node as any).type, x + maring, y);
      this.context.textAlign = 'right';
      this.context.fillText(node.objectId.toString(), x + width - maring, y);

      y += rowSpace * 0.8;

      this.context.textAlign = 'left';
      this.context.font = fontSize * 0.8 + 'px sans-serif';
      this.context.fillText('id: ' + node.id, x + maring, (y += rowSpace));
      this.context.fillText('level: ' + node.level, x + maring, (y += rowSpace));
      this.context.fillText('population: ' + node.population, x + maring, (y += rowSpace));
      this.context.fillText('size: ' + ((node as any).size), x + maring, (y += rowSpace));
    }
    if (width > 18 && width < 75) {
      const offset = height / 20;
      this.context.font = 'bold ' + fontSize * 4.5 + 'px sans-serif';
      this.context.fillText(node.population.toString(), x + width / 2, y + height / 2 + offset);
    }
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
