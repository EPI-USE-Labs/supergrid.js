(function (factory) {
    if (typeof define === 'function' && define.amd) {
        define(['jquery', 'lodash'], factory);
    } else if (typeof exports !== 'undefined') {
        try {jQuery = require('jquery');} catch (e) {}
        try {_ = require('lodash');} catch (e) {}
        factory(jQuery, _);
    } else {
        factory(jQuery, _);
    }
})(function ($, _) {
    var scope = window;

    var Item = function (element) {
        this.element = element;
        this.id = -1;
        this.x = Math.max(Math.min(element.data('grid-x') || 0, 6), 0);
        this.y = element.data('grid-y') || 0;
        this.width = Math.max(Math.min(element.data('grid-width') || 1, 6), 1);
        this.pixelY = 0;
        this.pixelHeight = 0;
        this.jsonId = -1;
    };

    Item.prototype.setId = function (id) {
        this.id = id;
        this.element.data('grid-id', id);
    };

    var SuperGrid = function (selector, options) {
        var self = this;

        this.options = _.defaults(options || {}, {
            staticGrid: true,
            resizableX: false,
            resizableY: false,
            animated: false,
            dragZIndex: 100,
            minItemWidth: 1,
            collapseContainerWidth: 700,
            onChange: function () {}
        });

        this.element = $(selector);
        this.items = [];
        this.draggingNodeId = -1;
        this.collapsed = false;
        this.containerWidth = this.element.innerWidth();

        this.placeholderElement = $('<div class="grid-placeholder" />').hide();
        this.element.append(this.placeholderElement);

        this.itemElements = $('.grid-item', this.element);
        this.itemElements.each(function (index, item) {
            self.addItem($(item));
        });

        this._onContainerWidthChange();

        if (this.options.animated) this.element.addClass('grid-animated');

        $(window).on('resize', function () {self._onContainerWidthChange();});

        // Schedule a relayout in case the content changes
        setTimeout(function () {self.layout();}, 0);
    };

    SuperGrid.prototype.addItem = function (element) {
        var item = new Item(element);
        item.setId(this.items.push(item) - 1);
        item.jsonId = element.data('id');

        item.element.addClass('grid-placed');

        if (!this.options.staticGrid) {
            element.draggable({
                containment: "parent",
                zIndex: this.options.dragZIndex,
                drag: this.onDrag.bind(this),
                start: this.onDragStart.bind(this),
                stop: this.onDragStop.bind(this)
            });

            if (this.options.resizableX || this.options.resizableY) {
                var handles = (this.options.resizableX ? ['e', 'w'] : []).concat((this.options.resizableY ? ['s'] : [])).join(',');
                element.resizable({
                    autoHide: true,
                    containment: "parent",
                    handles: handles,
                    resize: this.onResize.bind(this),
                    start: this.onDragStart.bind(this),
                    stop: this.onResizeStop.bind(this)
                });
            }
        }
    };

    SuperGrid.prototype.removeItem = function (item) {
        if (!this.options.staticGrid) {
            item.element.draggable("destroy");
            item.element.resizable("destroy");
        }

        item.element.data('grid-id', null);
        item.element.removeClass('grid-placed');
    };

    SuperGrid.prototype.destroy = function () {
        $(window).off('resize', this._onContainerWidthChange.bind(this));

        _.forEach(this.items, function (item) {this.removeItem(item);});
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

        var sortedItems = _.sortBy(this.items, function (n) {
            return n.y + ((n.id == self.draggingNodeId) ? 0.0 : 0.5) + (n.x / (6.0 * 2));
        });

        _.forEach(sortedItems, function (item) {
            var startX = item.x;
            var endX = item.x + item.width;
            var x;

            // Find starting pixel Y
            item.y = 0;
            item.pixelY = 0;
            for (x = startX; x < endX; x++) {
                if (lastY[x] > item.y) item.y = lastY[x];
                if (lastPixelY[x] > item.pixelY) item.pixelY = lastPixelY[x];
            }

            // Get own pixel height
            item.pixelHeight = item.element.outerHeight(true);

            // Record last Y coordinates in relevant columns
            for (x = startX; x < endX; x++) {
                lastY[x] = item.y + 1;
                lastPixelY[x] = item.pixelY + item.pixelHeight;
            }

            // Place item
            item.element.attr({'data-grid-x': item.x, 'data-grid-y': item.y});
            item.element.addClass('grid-placed');
            item.element.css({top: item.pixelY});

            // Expand container
            var endPixelY = item.pixelY + item.pixelHeight;
            if (containerHeight < endPixelY) containerHeight = endPixelY;
        });

        // Set container height
        this.element.css('height', containerHeight);
    };

    SuperGrid.prototype._updatePlaceholder = function (item) {
        this.placeholderElement.attr({'data-grid-x': item.x, 'data-grid-width': item.width});
        this.placeholderElement.css({top: item.pixelY, height: item.pixelHeight});
    };

    SuperGrid.prototype._updateNodeY = function (item, top) {
        item.y = 0;

        // If the item is pulled towards the top we should always put it first
        // even if the check wouldn't put it first so that it is possible to
        // put it first vertically
        if (top > 0) {
            var currentItemMiddle = top + item.pixelHeight * 0.5;

            _.forEach(this.items, function (otherItem) {
                if (item.id != otherItem.id) {
                    var otherItemMiddle = otherItem.pixelY + otherItem.pixelHeight * 0.5;
                    if (item.x + item.width > otherItem.x && item.x < otherItem.x + otherItem.width && currentItemMiddle >= otherItemMiddle) {
                        if (item.y < otherItem.y + 1) item.y = otherItem.y + 1;
                    }
                }
            });
        }
    };

    SuperGrid.prototype._updateNodeSize = function (item, position, size) {
        var old = {x: item.x, y: item.y, width: item.width};

        var errorMargin = 2;
        var origStartX = item.x;
        var origEndX = item.x + item.width;

        var startX = Math.floor((position.left + errorMargin) * 6.0 / this.containerWidth);
        var endX = Math.ceil((position.left + size.width - errorMargin)  * 6.0 / this.containerWidth);

        if (endX - startX < this.options.minItemWidth) {
            startX = origStartX;
            endX = origEndX;
        }

        item.x = startX;
        item.width = endX - startX;

        this._updateNodeY(item, position.top);

        return (old.x != item.x || old.y != item.y || old.width != item.width);
    };


    SuperGrid.prototype._updateNodePosition = function (item, position) {
        var old = {x: item.x, y: item.y};
        item.x = Math.max(Math.min(Math.round(position.left * 6.0 / this.containerWidth), 6), 0);
        this._updateNodeY(item, position.top);
        return (old.x != item.x || old.y != item.y);
    };

    SuperGrid.prototype.onResize = function (event, ui) {
        var item = this.items[ui.helper.data('grid-id')];

        this._updateNodeSize(item, ui.position, ui.size);
        this.layout();

        this._updatePlaceholder(item);
    };

    SuperGrid.prototype.onDrag = function (event, ui) {
        var item = this.items[ui.helper.data('grid-id')];

        this._updateNodePosition(item, ui.position);
        this.layout();

        this._updatePlaceholder(item);
    };

    SuperGrid.prototype.onDragStart = function (event, ui) {
        var item = this.items[ui.helper.data('grid-id')];

        this.draggingNodeId = item.id;

        this._updatePlaceholder(item);
        this.placeholderElement.show();
    };

    SuperGrid.prototype.onDragStop = function (event, ui) {
        var item = this.items[ui.helper.data('grid-id')];

        this.placeholderElement.hide();

        this._updateNodePosition(item, ui.position);

        item.element.attr({'data-grid-x': item.x, 'data-grid-width': item.width});
        item.element.css({width: '', left: ''});
        if (!this.options.resizableY) item.element.css({height: ''});

        this.layout();

        this.draggingNodeId = -1;
        this.options.onChange();
    };

    SuperGrid.prototype.onResizeStop = function (event, ui) {
        var item = this.items[ui.helper.data('grid-id')];

        this.placeholderElement.hide();

        this._updateNodeSize(item, ui.position, ui.size, ui.originalPosition);

        item.element.attr({'data-grid-x': item.x, 'data-grid-width': item.width});
        item.element.css({width: '', left: ''});
        if (!this.options.resizableY) item.element.css({height: ''});

        this.layout();

        this.draggingNodeId = -1;
        this.options.onChange();
    };

    SuperGrid.prototype._onContainerWidthChange = function () {
        this.containerWidth = this.element.innerWidth();

        var collapse = (this.containerWidth <= this.options.collapseContainerWidth);
        if (collapse != this.collapsed)
        {
            this.collapsed = collapse;
            if (collapse) {
                this.itemElements.not('.grid-vertical').addClass('grid-vertical');
                this.element.css({height: ''});
            }
            else {
                this.itemElements.removeClass('grid-vertical');
            }
        }

        this.layout();
    };

    SuperGrid.prototype.toJson = function () {
        return _.map(this.items, function (item) {
            return {id: item.jsonId, x_pos: item.x, y_pos: item.y, width: item.width};
        });
    };

    return scope.SuperGrid = SuperGrid;
});