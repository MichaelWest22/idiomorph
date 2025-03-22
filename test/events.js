describe("event morphing tests", function () {
  setup();

  it("morphs innerHTML with all events firing", function () {
    let initial = make(
      "<div><button jim='foo' jack='foo'><div>jim</div></button>></div>",
    );
    let finalSrc = '<button jack="bar" bar="foo">Bar</button>';
    let final = make(finalSrc);
    Idiomorph.morph(initial, final, {
      morphStyle: "innerHTML",
      eventCallbacks:
        "beforeNodeAdded,afterNodeAdded,beforeNodeMorphed,afterNodeMorphed,beforeNodeRemoved,afterNodeRemoved,beforeAttributeUpdated",
    });
    initial.outerHTML.should.equal(
      '<div><button jack="bar" bar="foo">Bar</button></div>',
    );
  });

  it("calls beforeNodeAdded event before a new node is added to the DOM", function () {
    let calls = [];
    function beforeNodeAdded(evt) {
      calls.push(evt.detail.node.outerHTML);
    }

    document.body.addEventListener("im-before-node-added", beforeNodeAdded);
    let initial = make("<ul><li>A</li></ul>");
    Idiomorph.morph(initial, "<ul><li>A</li><li>B</li></ul>", {
      eventCallbacks: "beforeNodeAdded",
    });
    document.body.removeEventListener("im-before-node-added", beforeNodeAdded);
    initial.outerHTML.should.equal("<ul><li>A</li><li>B</li></ul>");
    calls.should.eql(["<li>B</li>"]);
  });

  it("returning false to event beforeNodeAdded prevents adding the node", function () {
    function beforeNodeAdded(evt) {
      evt.preventDefault();
    }
    document.body.addEventListener("im-before-node-added", beforeNodeAdded);
    let initial = make("<ul><li>A</li></ul>");
    Idiomorph.morph(initial, "<ul><li>A</li><li>B</li></ul>", {
      eventCallbacks: "beforeNodeAdded",
    });
    document.body.removeEventListener("im-before-node-added", beforeNodeAdded);
    initial.outerHTML.should.equal("<ul><li>A</li></ul>");
  });
});
