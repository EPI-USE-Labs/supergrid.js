(function (factory) {
    if (typeof define === 'function' && define.amd) {
        define(['jquery', 'lodash'], factory);
    } else if (typeof exports !== 'undefined') {
        try {
            jQuery = require('jquery');
        } catch (e) {
        }
        try {
            _ = require('lodash');
        } catch (e) {
        }
        factory(jQuery, _);
    } else {
        factory(jQuery, _);
    }
})(function ($, _) {
    var scope = window;

    var Block = function (element) {
        this.element = element;
        this.id = -1;
        this.x = Math.max(Math.min(element.attr('data-grid-x') | 0, 6), 0);
        this.y = element.attr('data-grid-y') | 0;
        this.width = Math.max(Math.min((element.attr('data-grid-width') || 1) | 0, 6), 1);
        this.height = 0;
        this.fixedHeight = false;
        this.resizableWidth = !!element.data('grid-width-resizable');
        this.resizableHeight = !!element.data('grid-height-resizable');
        this.jsonId = -1;

        if (element.attr('data-grid-height')) {
            this.height = element.attr('data-grid-height') | 0;
            this.fixedHeight = true;
            this.element.css('height', this.height);
        }
    };

    Block.prototype.setId = function (id) {
        this.id = id;
        this.element.data('grid-id', id);
    };

    var SuperGrid = function (selector, options) {
        var self = this;

        this.options = _.defaults(options || {}, {
            staticGrid: true,
            resizableBlockWidth: false,
            resizableBlockHeight: false,
            animated: false,
            dragZIndex: 100,
            minBlockWidth: 1,
            minBlockHeight: 50,
            collapseContainerWidth: 700,
            heightSnapIncrement: false,
            onChange: function () {
            },
            onLoaded: function () {
            }
        });

        this.element = $(selector);
        this.blocks = [];
        this.draggingNodeId = -1;
        this.collapsed = false;
        this.containerWidth = this.element.innerWidth();

        this.placeholderElement = $('<div class="grid-placeholder" />').append($('<div class="grid-placeholder-content" />')).hide();
        this.element.append(this.placeholderElement);

        this.blockElements = $('.grid-block', this.element);

        // Fix initial positions to avoid layout flashes
        //
        var positions = [];
        this.blockElements.each(function (index, block) {
            var el = $(block);
            var p = el.position();
            positions.push({top: p.top, left: p.left, el: el});
        });

        var inverseSortedPositions = _.sortBy(positions, function (n) {
            return -(n.y + (n.x / (6.0 * 2)));
        });

        var i;
        for (i = 0; i < inverseSortedPositions.length; i++) {
            var p = inverseSortedPositions[i];
            p.el.css({top: p.top, left: p.left});
        }


        // Add blocks
        this.blockElements.each(function (index, block) {
            self.addBlock($(block));
        });

        this._onContainerWidthChange(true);

        $(window).on('resize', function () {
            self._onContainerWidthChange();
        });

        // Schedule a relayout in case the content changes
        setTimeout(function () {
            self.layout();
            self.options.onLoaded();
        }, 0);
    };

    SuperGrid.prototype.addBlock = function (element) {
        var block = new Block(element);
        block.setId(this.blocks.push(block) - 1);
        block.jsonId = element.data('id');

        block.element.addClass('grid-placed');

        if (!this.options.staticGrid) {
            element.draggable({
                containment: "parent",
                zIndex: this.options.dragZIndex,
                drag: this._onDrag.bind(this),
                start: this._onDragStart.bind(this),
                stop: this._onDragStop.bind(this)
            });

            var resizableX = this.options.resizableBlockWidth || block.resizableWidth;
            var resizableY = (this.options.resizableBlockHeight || block.resizableHeight) && block.fixedHeight;

            if (resizableX || resizableY) {
                var handles = (resizableX ? ['e', 'w'] : []).concat((resizableY ? ['s'] : [])).join(',');
                element.resizable({
                    autoHide: true,
                    containment: "parent",
                    handles: handles,
                    resize: this._onResize.bind(this),
                    start: this._onDragStart.bind(this),
                    stop: this._onResizeStop.bind(this)
                });
            }
        }
    };

    SuperGrid.prototype.removeBlock = function (blockOrElement) {
        var block;
        if (blockOrElement instanceof Block)
            block = blockOrElement;
        else
            block = this.blocks[$(blockOrElement).data('grid-id')];

        if (!this.options.staticGrid) {
            block.element.draggable("destroy");
            block.element.resizable("destroy");
        }

        block.element.data('grid-id', null);
        block.element.removeClass('grid-placed grid-vertical');
    };

    SuperGrid.prototype.destroy = function () {
        $(window).off('resize', this._onContainerWidthChange.bind(this));

        var self = this;
        _.forEach(this.blocks, function (block) {
            self.removeBlock(block);
        });
    };

    SuperGrid.prototype.layout = function (resizing) {
        if (this.collapsed) return;

        var self = this;

        var lastY = [];
        var lastPixelY = [];
        var containerHeight = 0;
        for (var i = 0; i < 6; i++) {
            lastY[i] = 0;
            lastPixelY[i] = 0;
        }

        var sortedBlocks = _.sortBy(this.blocks, function (n) {
            return n.y + ((n.id == self.draggingNodeId) ? 0.0 : 0.5) + (n.x / (6.0 * 2));
        });

        // Get block heights
        _.forEach(sortedBlocks, function (block) {
            if (!block.fixedHeight) block.height = block.element.outerHeight(true);
        });

        // Calculate positions
        _.forEach(sortedBlocks, function (block) {
            var startX = block.x;
            var endX = block.x + block.width;
            var x;

            // Find starting pixel Y
            block.y = 0;
            for (x = startX; x < endX; x++) {
                if (lastPixelY[x] > block.y) block.y = lastPixelY[x];
            }

            // Record last Y coordinates in relevant columns
            for (x = startX; x < endX; x++) {
                lastPixelY[x] = block.y + block.height;
            }

            // Expand container
            var endPixelY = block.y + block.height;
            if (containerHeight < endPixelY) containerHeight = endPixelY;
        });

        // Place blocks
        _.forEach(sortedBlocks, function (block) {
            block.element.attr({'data-grid-x': block.x, 'data-grid-y': block.y});
            block.element.addClass('grid-placed');
            block.element.css({top: block.y});
            if (!resizing) block.element.css({left: ''});
        });

        // Set container height
        this.element.css('height', containerHeight);
    };

    SuperGrid.prototype._updatePlaceholder = function (block) {
        this.placeholderElement.attr({'data-grid-x': block.x, 'data-grid-width': block.width});
        this.placeholderElement.css({top: block.y, height: block.height});
    };

    SuperGrid.prototype._updateBlockElement = function (block) {
        block.element.attr({'data-grid-x': block.x, 'data-grid-width': block.width});
        block.element.css({width: '', left: ''});

        if (block.fixedHeight) {
            block.element.attr('data-grid-height', block.height);
            block.element.css('height', block.height + 'px');
        }
        else
            block.element.css({height: ''});

    };

    SuperGrid.prototype._updateBlockY = function (block, top) {
        block.y = 0;

        // If the block is pulled towards the top we should always put it first
        // even if the check wouldn't put it first so that it is possible to
        // put it first vertically
        if (top > 0) {
            var currentBlockMiddle = top + block.height * 0.5;

            _.forEach(this.blocks, function (otherBlock) {
                if (block.id != otherBlock.id) {
                    var otherBlockMiddle = otherBlock.y + otherBlock.height * 0.5;
                    if (block.x + block.width > otherBlock.x && block.x < otherBlock.x + otherBlock.width && currentBlockMiddle >= otherBlockMiddle) {
                        if (block.y < otherBlock.y + 1) block.y = otherBlock.y + 1;
                    }
                }
            });
        }
    };

    SuperGrid.prototype._updateBlockSize = function (block, position, size) {
        var old = {x: block.x, y: block.y, width: block.width};

        var errorMargin = 2;
        var origStartX = block.x;
        var origEndX = block.x + block.width;

        var startX = Math.floor((position.left + errorMargin) * 6.0 / this.containerWidth);
        var endX = Math.ceil((position.left + size.width - errorMargin) * 6.0 / this.containerWidth);

        if (endX - startX < this.options.minBlockWidth) {
            startX = origStartX;
            endX = origEndX;
        }

        block.x = startX;
        block.width = endX - startX;

        var height = size.height;
        if (height < this.options.minBlockHeight)
            height = this.options.minBlockHeight;

        if (this.options.heightSnapIncrement)
            block.height = Math.ceil(height / this.options.heightSnapIncrement) * this.options.heightSnapIncrement;
        else
            block.height = height;

        this._updateBlockY(block, position.top);

        return (old.x != block.x || old.y != block.y || old.width != block.width);
    };

    SuperGrid.prototype._updateBlockPosition = function (block, position) {
        var old = {x: block.x, y: block.y};
        block.x = Math.max(Math.min(Math.round(position.left * 6.0 / this.containerWidth), 6), 0);
        this._updateBlockY(block, position.top);
        return (old.x != block.x || old.y != block.y);
    };

    SuperGrid.prototype._onResize = function (event, ui) {
        var block = this.blocks[ui.helper.data('grid-id')];

        this._updateBlockSize(block, ui.position, ui.size);
        this.layout(true);
        this._updatePlaceholder(block);
    };

    SuperGrid.prototype._onDrag = function (event, ui) {
        var block = this.blocks[ui.helper.data('grid-id')];

        this._updateBlockPosition(block, ui.position);
        this.layout();
        this._updatePlaceholder(block);
    };

    SuperGrid.prototype._onDragStart = function (event, ui) {
        var block = this.blocks[ui.helper.data('grid-id')];

        this.draggingNodeId = block.id;

        this._updatePlaceholder(block);
        this.placeholderElement.show();

        if (this.options.animated) this.element.addClass('grid-animated');
    };

    SuperGrid.prototype._onDragStop = function (event, ui) {
        var block = this.blocks[ui.helper.data('grid-id')];

        this.placeholderElement.hide();

        this._updateBlockPosition(block, ui.position);
        this._updateBlockElement(block);
        this.layout();

        this.draggingNodeId = -1;
        this.options.onChange();

        if (this.options.animated) this.element.removeClass('grid-animated');
    };

    SuperGrid.prototype._onResizeStop = function (event, ui) {
        var block = this.blocks[ui.helper.data('grid-id')];

        this.placeholderElement.hide();

        this._updateBlockSize(block, ui.position, ui.size);
        this._updateBlockElement(block);
        this.layout();

        this.draggingNodeId = -1;
        this.options.onChange();

        if (this.options.animated) this.element.removeClass('grid-animated');
    };

    SuperGrid.prototype._onContainerWidthChange = function (force) {
        var newWidth = this.element.innerWidth();
        if (force || newWidth != this.containerWidth) {
            this.containerWidth = newWidth;

            var collapse = (this.containerWidth <= this.options.collapseContainerWidth);
            if (collapse != this.collapsed) {
                this.collapsed = collapse;
                if (collapse) {
                    this.blockElements.not('.grid-vertical').addClass('grid-vertical');
                    this.element.css({height: ''});
                }
                else {
                    this.blockElements.removeClass('grid-vertical');
                }
            }

            this.layout();
        }
    };

    SuperGrid.prototype.toJson = function () {
        return _.map(this.blocks, function (block) {
            if (block.fixedHeight)
                return {id: block.jsonId, x_pos: block.x, y_pos: block.y, width: block.width, height: block.height};
            else
                return {id: block.jsonId, x_pos: block.x, y_pos: block.y, width: block.width};
        });
    };

    SuperGrid.prototype.openSpaces = function (minHeight, endSpaceHeight) {
        minHeight = (typeof minHeight === 'undefined') ? this.options.minBlockHeight : minHeight;
        endSpaceHeight = (typeof endSpaceHeight === 'undefined') ? 0 : endSpaceHeight;

        var self = this;

        var x;
        var lastPixelY = [];
        var openSpaces = [];
        for (var i = 0; i < 6; i++) {
            lastPixelY[i] = 0;
        }

        this.layout(false);

        var sortedBlocks = _.sortBy(this.blocks, function (n) {
            return n.y + ((n.id == self.draggingNodeId) ? 0.0 : 0.5) + (n.x / (6.0 * 2));
        });

        // Get open spaces
        _.forEach(sortedBlocks, function (block) {
            var startX = block.x;
            var endX = block.x + block.width;

            var space = {x_pos: 0, y_pos: 0, width: 0, height: 0};

            for (x = startX; x < endX; x++) {
                var lastY = lastPixelY[x];
                var height = block.y - lastY;

                // If the top is at a different height, add the current space
                if (space.height !== height || space.y_pos !== lastY) {
                    if (space.height >= minHeight) {
                        space.width = x - space.x_pos;
                        openSpaces.push(space);
                    }

                    space = {x_pos: x, y_pos: lastY, width: 0, height: height};
                }
            }

            if (space.height >= minHeight) {
                space.width = x - space.x_pos;
                openSpaces.push(space);
            }

            // Record last Y coordinates in relevant columns
            for (x = startX; x < endX; x++) lastPixelY[x] = block.y + block.height;
        });

        if (endSpaceHeight > 0) {
            var space = {x_pos: 0, y_pos: 0, width: 0, height: 0};

            for (x = 0; x < 6; x++) {
                var lastY = lastPixelY[x];
                if (space.y_pos !== lastY) {
                    if (space.height !== 0) {
                        space.width = x - space.x_pos;
                        openSpaces.push(space);
                    }

                    space = {x_pos: x, y_pos: lastY, width: 0, height: endSpaceHeight};
                }
            }

            if (space.height !== 0) {
                space.width = x - space.x_pos;
                openSpaces.push(space);
            }
        }

        return openSpaces;
    };

    SuperGrid.prototype.pack = function () {
        var self = this;

        var lastPixelY = [];
        var containerHeight = 0;
        for (var i = 0; i < 6; i++) {
            lastPixelY[i] = 0;
        }

        this.layout(false);

        var sortedBlocks = _.sortBy(this.blocks, function (n) {
            return n.y + ((n.id == self.draggingNodeId) ? 0.0 : 0.5) + (n.x / (6.0 * 2));
        });

        // Calculate positions
        _.forEach(sortedBlocks, function (block) {
            var x, y, startX, blockX, startY;
            var bestStartY = -1;
            var bestStartX = 0;

            // Find first open spot
            for (startX = 0; startX <= 6 - block.width; startX++) {
                startY = 0;
                for (blockX = 0; blockX < block.width; blockX++) {
                    x = startX + blockX;
                    y = lastPixelY[x];
                    if (y > startY) startY = y;
                }

                if (bestStartY === -1 || startY < bestStartY) {
                    bestStartY = startY;
                    bestStartX = startX;
                }
            }

            block.x = bestStartX;
            block.y = bestStartY;

            // Record last Y coordinates in relevant columns
            for (x = block.x; x < block.x + block.width; x++) {
                lastPixelY[x] = block.y + block.height;
            }

            // Expand container
            var endPixelY = block.y + block.height;
            if (containerHeight < endPixelY) containerHeight = endPixelY;
        });

        this.layout(false);
    };

    return scope.SuperGrid = SuperGrid;
});