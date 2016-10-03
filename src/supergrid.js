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

    var Node = function (element) {
        this.element = element;
        this.id = -1;
        this.x = Math.max(Math.min(element.data('grid-x') || 0, 6), 0);
        this.y = element.data('grid-y') || 0;
        this.width = Math.max(Math.min(element.data('grid-width') || 1, 6), 1);
        this.pixelY = 0;
        this.pixelHeight = 0;
        this.jsonId = -1;
    };

    Node.prototype.setId = function (id) {
        this.id = id;
        this.element.data('grid-id', id);
    };

    var SuperGrid = function (selector, options) {
        var self = this;

        this.options = _.defaults(options || {}, {
            staticGrid: true,
            resizableX: false,
            resizableY: false,
            dragZIndex: 100,
            minItemWidth: 1,
            collapseContainerWidth: 700,
            onChange: function () {}
        });

        this.element = $(selector);
        this.nodes = [];
        this.draggingNodeId = -1;
        this.collapsed = false;
        this.containerWidth = this.element.innerWidth();

        this.placeholderElement = $('<div class="grid-placeholder" />').hide();
        this.element.append(this.placeholderElement);

        this.itemElements = $('.grid-item', this.element);
        this.itemElements.each(function (index, item) {
            self.addNode($(item));
        });

        this._onContainerWidthChange();

        $(window).on('resize', function () {self._onContainerWidthChange();});

        // Schedule a relayout in case the content changes
        setTimeout(function () {self.layout();}, 0);
    };

    SuperGrid.prototype.addNode = function (element) {
        var node = new Node(element);
        node.setId(this.nodes.push(node) - 1);
        node.jsonId = element.data('id');

        node.element.addClass('grid-placed');

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

    SuperGrid.prototype.removeNode = function (node) {
        if (!this.options.staticGrid) {
            node.element.draggable("destroy");
            node.element.resizable("destroy");
        }

        node.element.data('grid-id', null);
        node.element.removeClass('grid-placed');
    };

    SuperGrid.prototype.destroy = function () {
        $(window).off('resize', this._onContainerWidthChange.bind(this));

        _.forEach(this.nodes, function (node) {this.removeNode(node);});
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

        var sortedNodes = _.sortBy(this.nodes, function (n) {
            return n.y + ((n.id == self.draggingNodeId) ? 0.0 : 0.5) + (n.x / (6.0 * 2));
        });

        _.forEach(sortedNodes, function (node) {
            var startX = node.x;
            var endX = node.x + node.width;
            var x;

            // Find starting pixel Y
            node.y = 0;
            node.pixelY = 0;
            for (x = startX; x < endX; x++) {
                if (lastY[x] > node.y) node.y = lastY[x];
                if (lastPixelY[x] > node.pixelY) node.pixelY = lastPixelY[x];
            }

            // Get own pixel height
            node.pixelHeight = node.element.outerHeight(true);

            // Record last Y coordinates in relevant columns
            for (x = startX; x < endX; x++) {
                lastY[x] = node.y + 1;
                lastPixelY[x] = node.pixelY + node.pixelHeight;
            }

            // Place item
            node.element.attr({'data-grid-x': node.x, 'data-grid-y': node.y});
            node.element.addClass('grid-placed');
            node.element.css({top: node.pixelY});

            // Expand container
            var endPixelY = node.pixelY + node.pixelHeight;
            if (containerHeight < endPixelY) containerHeight = endPixelY;
        });

        // Set container height
        this.element.css('height', containerHeight);
    };

    SuperGrid.prototype._updatePlaceholder = function (node) {
        this.placeholderElement.attr({'data-grid-x': node.x, 'data-grid-width': node.width});
        this.placeholderElement.css({top: node.pixelY, height: node.pixelHeight});
    };

    SuperGrid.prototype._updateNodeY = function (node, top) {
        node.y = 0;

        // If the item is pulled towards the top we should always put it first
        // even if the check wouldn't put it first so that it is possible to
        // put it first vertically
        if (top > 0) {
            var currentNodeMiddle = top + node.pixelHeight * 0.5;

            _.forEach(this.nodes, function (otherNode) {
                if (node.id != otherNode.id) {
                    var otherNodeMiddle = otherNode.pixelY + otherNode.pixelHeight * 0.5;
                    if (node.x + node.width > otherNode.x && node.x < otherNode.x + otherNode.width && currentNodeMiddle >= otherNodeMiddle) {
                        if (node.y < otherNode.y + 1) node.y = otherNode.y + 1;
                    }
                }
            });
        }
    };

    SuperGrid.prototype._updateNodeSize = function (node, position, size) {
        var old = {x: node.x, y: node.y, width: node.width};

        var errorMargin = 2;
        var origStartX = node.x;
        var origEndX = node.x + node.width;

        var startX = Math.floor((position.left + errorMargin) * 6.0 / this.containerWidth);
        var endX = Math.ceil((position.left + size.width - errorMargin)  * 6.0 / this.containerWidth);

        if (endX - startX < this.options.minItemWidth) {
            startX = origStartX;
            endX = origEndX;
        }

        node.x = startX;
        node.width = endX - startX;

        this._updateNodeY(node, position.top);

        return (old.x != node.x || old.y != node.y || old.width != node.width);
    };


    SuperGrid.prototype._updateNodePosition = function (node, position) {
        var old = {x: node.x, y: node.y};
        node.x = Math.max(Math.min(Math.round(position.left * 6.0 / this.containerWidth), 6), 0);
        this._updateNodeY(node, position.top);
        return (old.x != node.x || old.y != node.y);
    };

    SuperGrid.prototype.onResize = function (event, ui) {
        var node = this.nodes[ui.helper.data('grid-id')];

        this._updateNodeSize(node, ui.position, ui.size);
        this.layout();

        this._updatePlaceholder(node);
    };

    SuperGrid.prototype.onDrag = function (event, ui) {
        var node = this.nodes[ui.helper.data('grid-id')];

        this._updateNodePosition(node, ui.position);
        this.layout();

        this._updatePlaceholder(node);
    };

    SuperGrid.prototype.onDragStart = function (event, ui) {
        var node = this.nodes[ui.helper.data('grid-id')];

        this.draggingNodeId = node.id;

        this._updatePlaceholder(node);
        this.placeholderElement.show();
    };

    SuperGrid.prototype.onDragStop = function (event, ui) {
        var node = this.nodes[ui.helper.data('grid-id')];

        this.placeholderElement.hide();

        this._updateNodePosition(node, ui.position);

        node.element.attr({'data-grid-x': node.x, 'data-grid-width': node.width});
        node.element.css({width: '', left: ''});
        if (!this.options.resizableY) node.element.css({height: ''});

        this.layout();

        this.draggingNodeId = -1;
        this.options.onChange();
    };

    SuperGrid.prototype.onResizeStop = function (event, ui) {
        var node = this.nodes[ui.helper.data('grid-id')];

        this.placeholderElement.hide();

        this._updateNodeSize(node, ui.position, ui.size, ui.originalPosition);

        node.element.attr({'data-grid-x': node.x, 'data-grid-width': node.width});
        node.element.css({width: '', left: ''});
        if (!this.options.resizableY) node.element.css({height: ''});

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
        return _.map(this.nodes, function (node) {
            return {id: node.jsonId, x_pos: node.x, y_pos: node.y, width: node.width};
        });
    };

    return scope.SuperGrid = SuperGrid;
});