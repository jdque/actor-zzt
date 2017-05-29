type TileMap = number[];

export class TilemapCollider {
    tilemap: TileMap;
    width: number;
    height: number;

    constructor(tilemap: TileMap, width: number, height: number) {
        this.tilemap = tilemap;
        this.width = width;
        this.height = height;
    }

    getTile(x: number, y: number): number {
        if (x > this.width - 1 || y > this.height - 1) {
            return null;
        }
        return this.tilemap[this.width * y + x];
    }

    getTilesInRect(rect: PIXI.Rectangle): TileMap {
        let tiles = [];
        for (let y = rect.top; y < rect.bottom; y += 8) {
            for (let x = rect.left; x < rect.right; x += 8) {
                tiles.push(this.getTile(x / 8, y / 8));
            }
        }

        return tiles;
    }

    anyTileInRect(rect: PIXI.Rectangle): boolean {
        for (let y = rect.top; y < rect.bottom; y += 8) {
            for (let x = rect.left; x < rect.right; x += 8) {
                let tile = this.getTile(x / 8, y / 8);
                if (tile !== 0) {
                    return true;
                }
            }
        }

        return false;
    }
}
