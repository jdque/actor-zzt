export function TilemapCollider(tilemap, width, height) {
    this.tilemap = tilemap;
    this.width = width;
    this.height = height;
}

TilemapCollider.prototype.getTile = function (x, y) {
    if (x > this.width - 1 || y > this.height - 1) {
        return null;
    }
    return this.tilemap[this.width * y + x];
}

TilemapCollider.prototype.getTilesInRect = function (rect) {
    var tiles = [];
    for (var y = rect.y, endY = rect.y + rect.height; y < endY; y += 8) {
        for (var x = rect.x, endX = rect.x + rect.width; x < endX; x += 8) {
            tiles.push(this.getTile(x / 8, y / 8));
        }
    }

    return tiles;
}

TilemapCollider.prototype.anyTileInRect = function (rect) {
    for (var y = rect.y, endY = rect.y + rect.height; y < endY; y += 8) {
        for (var x = rect.x, endX = rect.x + rect.width; x < endX; x += 8) {
            var tile = this.getTile(x / 8, y / 8);
            if (tile !== 0) {
                return true;
            }
        }
    }

    return false;
}