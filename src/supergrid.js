(function (factory) {
    if (typeof define === 'function' && define.amd) {
        define(['jquery', 'lodash'], factory);
    } else if (typeof exports !== 'undefined') {
        try { jQuery = require('jquery'); } catch (e) { }
        try { _ = require('lodash'); } catch (e) { }
        factory(jQuery, _);
    } else {
        factory(jQuery, _);
    }
})(function ($, _) {
    var scope = window;

    var Block = function (element) {
        this.element = element;
        this.id = -1;
        this.x = Math.max(Math.min(element.data('grid-x') || 0, 6), 0);
        this.y = element.data('grid-y') || 0;
        this.width = Math.max(Math.min(element.data('grid-width') || 1, 6), 1);
        this.pixelY = 0;
        this.pixelHeight = 0;
        this.fixedHeight = false;
        this.resizableWidth = !!element.data('grid-width-resizable');
        this.resizableHeight = !!element.data('grid-height-resizable');
        this.jsonId = -1;

        var height = element.data('grid-height');
        if (height) {
            this.pixelHeight = height;
            this.fixedHeight = true;
            this.element.css('height', this.pixelHeight);
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
            collapseContainerWidth: 700,
            onChange: function () {
            }
        });

        this.element = $(selector);
        this.blocks = [];
        this.draggingNodeId = -1;
        this.collapsed = false;
        this.containerWidth = this.element.innerWidth();

        this.placeholderElement = $('<div class="grid-placeholder" />').hide();
        this.element.append(this.placeholderElement);

        this.blockElements = $('.grid-block', this.element);
        this.blockElements.each(function (index, block) {
            self.addBlock($(block));
        });

        this._onContainerWidthChange();

        if (this.options.animated) this.element.addClass('grid-animated');

        $(window).on('resize', function () {
            self._onContainerWidthChange();
        });

        // Schedule a relayout in case the content changes
        setTimeout(function () {
            self.layout();
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
        block.element.removeClass('grid-placed');
    };

    SuperGrid.prototype.destroy = function () {
        $(window).off('resize', this._onContainerWidthChange.bind(this));

        var self = this;
        _.forEach(this.blocks, function (block) {
            self.removeBlock(block);
        });
    };

    SuperGrid.prototype.layout = function () {
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

        _.forEach(sortedBlocks, function (block) {
            var startX = block.x;
            var endX = block.x + block.width;
            var x;

            // Find starting pixel Y
            block.y = 0;
            block.pixelY = 0;
            for (x = startX; x < endX; x++) {
                if (lastY[x] > block.y) block.y = lastY[x];
                if (lastPixelY[x] > block.pixelY) block.pixelY = lastPixelY[x];
            }

            // Get own pixel height
            if (!block.fixedHeight) block.pixelHeight = block.element.outerHeight(true);

            // Record last Y coordinates in relevant columns
            for (x = startX; x < endX; x++) {
                lastY[x] = block.y + 1;
                lastPixelY[x] = block.pixelY + block.pixelHeight;
            }

            // Place block
            block.element.attr({'data-grid-x': block.x, 'data-grid-y': block.y});
            block.element.addClass('grid-placed');
            block.element.css({top: block.pixelY});

            // Expand container
            var endPixelY = block.pixelY + block.pixelHeight;
            if (containerHeight < endPixelY) containerHeight = endPixelY;
        });

        // Set container height
        this.element.css('height', containerHeight);
    };

    SuperGrid.prototype._updatePlaceholder = function (block) {
        this.placeholderElement.attr({'data-grid-x': block.x, 'data-grid-width': block.width});
        this.placeholderElement.css({top: block.pixelY, height: block.pixelHeight});
    };

    SuperGrid.prototype._updateBlockY = function (block, top) {
        block.y = 0;

        // If the block is pulled towards the top we should always put it first
        // even if the check wouldn't put it first so that it is possible to
        // put it first vertically
        if (top > 0) {
            var currentBlockMiddle = top + block.pixelHeight * 0.5;

            _.forEach(this.blocks, function (otherBlock) {
                if (block.id != otherBlock.id) {
                    var otherBlockMiddle = otherBlock.pixelY + otherBlock.pixelHeight * 0.5;
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

        this._updateBlockY(block, position.top);
        if (block.fixedHeight) block.pixelHeight = size.height;

        return (old.x != block.x || old.y != block.y || old.width != block.width);
    };

    SuperGrid.prototype._updateBlockPosition = function (block, position) {
        var old = {x: block.x, y: block.y};
        block.x = Math.max(Math.min(Math.round(position.left * 6.0 / this.containerWidth), 6), 0);
        this._updateBlockY(block, position.top);
        return (old.x != block.x || old.y != block.y);
    };

    SuperGrid.prototype._updateBlockElement = function (block) {
        block.element.attr({'data-grid-x': block.x, 'data-grid-width': block.width});
        block.element.css({width: '', left: ''});
        if (!block.fixedHeight) block.element.css({height: ''});
    };

    SuperGrid.prototype._onResize = function (event, ui) {
        var block = this.blocks[ui.helper.data('grid-id')];

        this._updateBlockSize(block, ui.position, ui.size);
        this.layout();
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
    };

    SuperGrid.prototype._onDragStop = function (event, ui) {
        var block = this.blocks[ui.helper.data('grid-id')];

        this.placeholderElement.hide();

        this._updateBlockPosition(block, ui.position);
        this._updateBlockElement(block);
        this.layout();

        this.draggingNodeId = -1;
        this.options.onChange();
    };

    SuperGrid.prototype._onResizeStop = function (event, ui) {
        var block = this.blocks[ui.helper.data('grid-id')];

        this.placeholderElement.hide();

        this._updateBlockSize(block, ui.position, ui.size);
        this._updateBlockElement(block);
        this.layout();

        this.draggingNodeId = -1;
        this.options.onChange();
    };

    SuperGrid.prototype._onContainerWidthChange = function () {
        var newWidth = this.element.innerWidth();
        if (newWidth != this.containerWidth) {
            this.containerWidth = this.element.innerWidth();

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
                return {id: block.jsonId, x_pos: block.x, y_pos: block.y, width: block.width, height: block.pixelHeight};
            else
                return {id: block.jsonId, x_pos: block.x, y_pos: block.y, width: block.width};
        });
    };

    return scope.SuperGrid = SuperGrid;
});