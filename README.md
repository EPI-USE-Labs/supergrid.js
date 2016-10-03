# SuperGrid

SuperGrid is a javascript grid library fo the browser that supports drag-and-drop and resizing. It uses a fixed 6-column
layout where blocks always fall to the top of the grid. Both dynamic-height and fixed-height blocks are supported.

SuperGrid is inspired by gridstack.js and gridster.js.

## Layout

Each block has a x-position, a y-position, a width and an optional height. The x-position and width is in columns. The y-position is
unit-less and only the relative y-positions between blocks matter. The height is in pixels. If the y-position of a block is larger than another 
block's then it will be placed below that block. If they are the same and they overlap on the x-axis then the block with
the larger x-position is placed below the other block. If they still tie then their order in the html is used to
determine their order.

## Fixed-height vs Dynamic-height blocks

Dynamic-height blocks adapt their height to their contents. If a block is given a height it will be a fixed-height block
which will have the given height regardless of its contents. Fixed-height blocks also output an height value in the JSON
but dynamic-height blocks don't. Dynamic-height blocks can not be resized vertically.

## Usage
`var superGrid = new SuperGrid(<selector>, <options>);`

### Browser support
 IE8-IE10 is supported for static grids only.

### Requirements

* lodash.js
* jQuery

**For dragging or resizing**

* jQuery UI

### Options

* *animated* (default: false)
  When set to true, blocks are animated when dragging or resizing.

* *collapseContainerWidth* (default: 700)
  When the container width falls below this width in pixels then the grid will collapse to a single column.

* *dragZIndex* (default: 100)
  The z-index given to the block being dragged.
  
* *minBlockWidth* (default: 1)
  The minimum amount of columns an block must span. Blocks can not be resized to be smaller than this.
  
* *resizableBlockWidth* (default: false)
  When set to true and staticGrid is false, horizontal resizing is enabled for all blocks. Block widths snap to columns.
  
* *resizableBlockHeight* (default: false)
  When set to true and staticGrid is false, vertical resizing is enabled for all blocks. Blocks can be resized to any height.

* *staticGrid* (default: true)
  IF set then no resizing or dragging is possible otherwise dragging and resizing is enabled (resizing is dependent on other options) but requires jQuery UI.

### CSS classes

* *grid*
  The container div must have the *grid* class
  
* *grid-block*
    For each block in the grid there must be a div with the *grid-block* class
  
    Attributes:
    
    * *data-id* (Optional) - ID used when generating JSON.
    * *data-grid-x* - X-position of block in columns.
    * *data-grid-width* - Width of block in columns.
    * *data-grid-y* - Y-position of block.
    * *data-grid-height* (Optional) - Height of the block in pixels. If given the block becomes a fixed-height block.
    * *data-grid-height-resizable* (Optional) - If true then the block's height is resizable even if resizableBlockHeight is false
    * *data-grid-width-resizable* (Optional) - If true then the block's width is resizable even resizableBlockWidth is false
  
* *grid-block-content*
  Each *grid-block* must have a *grid-block-content* div directly inside of it

### Methods

* `layout()`
    Used to force a relayout of the grid when, for example, the height of a block changes.
    
* `addBlock(<element>)`
    Add a block that didn't exist when SuperGrid was initialized. The element must already
    be added to the container.
    
* `removeBlock(<element>)`
    Remove a block from SuperGrid. The element must be manually removed from container.
    
* `toJson()`
    Generates JSON array of blocks with each block in the following format:
    `{id: <id>, x_pos: <x>, y_pos: <y>, width: <width>, [height: <height>]}`
    
* `destroy()`
    Removes all blocks from SuperGrid and removes all attached events.

### Example

```HTML
    <div id="grid-container" class="grid">
        <div class="grid-block" data-id="1" data-grid-x="0" data-grid-y="0" data-grid-width="3">
            <div class="grid-block-content">
                <h1>Heading 1</h1>
                <p>Text 1</p>
            </div>
        </div>
        <div class="grid-block" data-id="2" data-grid-x="1" data-grid-y="0" data-grid-width="3" data-grid-height="200">
            <div class="grid-block-content">
                <h1>Heading 2</h1>
                <p>Text 2</p>
            </div>
        </div>
    </div>
    <script>
        new SuperGrid('#grid-container', {staticGrid: true});
    </script>
```