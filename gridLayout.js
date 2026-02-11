// Grid Layout System
class GridLayout {
  constructor(config) {
    this.columns = config.columns || 3;
    this.rows = config.rows || 2;
    this.spacing = config.spacing || 4;
    this.cellWidth = 0;
    this.cellHeight = 0;
    this.cells = [];
  }

  calculateLayout(canvasWidth, canvasHeight) {
    const totalSpacing = this.spacing * (this.columns + 1);
    const totalSpacingVertical = this.spacing * (this.rows + 1);
    
    this.cellWidth = (canvasWidth - totalSpacing) / this.columns;
    this.cellHeight = (canvasHeight - totalSpacingVertical) / this.rows;
    
    // Calculate cell positions
    this.cells = [];
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.columns; col++) {
        const x = this.spacing + col * (this.cellWidth + this.spacing);
        const y = this.spacing + row * (this.cellHeight + this.spacing);
        this.cells.push({
          x: x,
          y: y,
          width: this.cellWidth,
          height: this.cellHeight,
          row: row,
          col: col
        });
      }
    }
  }

  getCell(index) {
    if (index >= 0 && index < this.cells.length) {
      return this.cells[index];
    }
    return null;
  }

  getCellCount() {
    return this.cells.length;
  }
}
