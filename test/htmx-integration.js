describe("Tests for the htmx integration", function () {
  function makeServer() {
    var server = sinon.fakeServer.create();
    htmx.config.defaultSettleDelay = 0;
    server.fakeHTTPMethods = true;
    return server;
  }

  beforeEach(function () {
    this.server = makeServer();
    clearWorkArea();
  });

  afterEach(function () {
    this.server.restore();
  });

  function makeForHtmxTest(htmlStr) {
    let elt = make(htmlStr);
    getWorkArea().appendChild(elt);
    htmx.process(elt);
    return elt;
  }

  it("keeps the element stable in an outer morph", function () {
    this.server.respondWith(
      "GET",
      "/test",
      "<button id='b1' hx-swap='morph' hx-get='/test' class='bar'>Foo</button>",
    );
    let initialBtn = makeForHtmxTest(
      "<button id='b1' hx-swap='morph' hx-get='/test'>Foo</button>",
    );
    initialBtn.click();
    this.server.respond();
    let newBtn = document.getElementById("b1");
    initialBtn.should.equal(newBtn);
    initialBtn.classList.contains("bar").should.equal(true);
  });

  it("keeps the element live in an outer morph", function () {
    this.server.respondWith(
      "GET",
      "/test",
      "<button id='b1' hx-swap='morph' hx-get='/test2' class='bar'>Foo</button>",
    );
    this.server.respondWith(
      "GET",
      "/test2",
      "<button id='b1' hx-swap='morph' hx-get='/test3' class='doh'>Foo</button>",
    );
    let initialBtn = makeForHtmxTest(
      "<button id='b1' hx-swap='morph' hx-get='/test'>Foo</button>",
    );

    initialBtn.click();
    this.server.respond();
    let newBtn = document.getElementById("b1");
    initialBtn.should.equal(newBtn);
    initialBtn.classList.contains("bar").should.equal(true);
    initialBtn.classList.contains("doh").should.equal(false);

    initialBtn.click();
    this.server.respond();
    newBtn = document.getElementById("b1");
    initialBtn.should.equal(newBtn);
    initialBtn.classList.contains("bar").should.equal(false);
    initialBtn.classList.contains("doh").should.equal(true);
  });

  it("keeps the element stable in an outer morph w/ explicit syntax", function () {
    this.server.respondWith(
      "GET",
      "/test",
      "<button id='b1' hx-swap='morph:outerHTML' hx-get='/test' class='bar'>Foo</button>",
    );
    let initialBtn = makeForHtmxTest(
      "<button id='b1' hx-swap='morph:outerHTML' hx-get='/test'>Foo</button>",
    );
    initialBtn.click();
    this.server.respond();
    let newBtn = document.getElementById("b1");
    initialBtn.should.equal(newBtn);
    initialBtn.classList.contains("bar").should.equal(true);
  });

  it("keeps the element live in an outer morph w/explicit syntax", function () {
    this.server.respondWith(
      "GET",
      "/test",
      "<button id='b1' hx-swap='morph:outerHTML' hx-get='/test2' class='bar'>Foo</button>",
    );
    this.server.respondWith(
      "GET",
      "/test2",
      "<button id='b1' hx-swap='morph:outerHTML' hx-get='/test3' class='doh'>Foo</button>",
    );
    let initialBtn = makeForHtmxTest(
      "<button id='b1' hx-swap='morph:outerHTML' hx-get='/test'>Foo</button>",
    );

    initialBtn.click();
    this.server.respond();
    let newBtn = document.getElementById("b1");
    initialBtn.should.equal(newBtn);
    initialBtn.classList.contains("bar").should.equal(true);
    initialBtn.classList.contains("doh").should.equal(false);

    initialBtn.click();
    this.server.respond();
    newBtn = document.getElementById("b1");
    initialBtn.should.equal(newBtn);
    initialBtn.classList.contains("bar").should.equal(false);
    initialBtn.classList.contains("doh").should.equal(true);
  });

  it("keeps elements stable in an inner morph", function () {
    this.server.respondWith(
      "GET",
      "/test",
      "<button id='b1' class='bar'>Foo</button>",
    );
    let div = makeForHtmxTest(
      "<div hx-swap='morph:innerHTML' hx-get='/test'><button id='b1'>Foo</button></div>",
    );
    let initialBtn = document.getElementById("b1");
    div.click();
    this.server.respond();
    let newBtn = document.getElementById("b1");
    initialBtn.should.equal(newBtn);
    initialBtn.classList.contains("bar").should.equal(true);
    div.innerHTML.should.equal(initialBtn.outerHTML);
  });

  it("keeps elements stable in an inner morph w/ inner addConfig", function () {
    this.server.respondWith(
      "GET",
      "/test",
      "<button id='b1' class='bar'>Foo</button>",
    );
    let div = makeForHtmxTest(
      "<div hx-swap='morph:inner' hx-get='/test'><button id='b1'>Foo</button></div>",
    );
    Idiomorph.addConfig("inner", { morphStyle: "innerHTML" });
    let initialBtn = document.getElementById("b1");
    div.click();
    this.server.respond();
    let newBtn = document.getElementById("b1");
    initialBtn.should.equal(newBtn);
    initialBtn.classList.contains("bar").should.equal(true);
    div.innerHTML.should.equal(initialBtn.outerHTML);
  });

  it("keeps the element stable in an outer morph with oob-swap", function () {
    this.server.respondWith(
      "GET",
      "/test",
      "<button id='b1' hx-swap-oob='morph'>Bar</button>",
    );
    let div = makeForHtmxTest(
      "<div hx-get='/test' hx-swap='none'><button id='b1'>Foo</button></div>",
    );
    let initialBtn = document.getElementById("b1");
    div.click();
    this.server.respond();
    let newBtn = document.getElementById("b1");
    initialBtn.should.equal(newBtn);
    initialBtn.innerHTML.should.equal("Bar");
  });

  it("keeps the element stable in an inner morph with oob-swap", function () {
    this.server.respondWith(
      "GET",
      "/test",
      "<div id='d1' hx-swap-oob='morph;innerHTML'><button id='b1'>Bar</button></div>",
    );
    let div = makeForHtmxTest(
      "<div id='d1' hx-get='/test' hx-swap='none'><button id='b1'>Foo</button></div>",
    );
    let initialBtn = document.getElementById("b1");
    div.click();
    this.server.respond();
    let newBtn = document.getElementById("b1");
    initialBtn.should.equal(newBtn);
    initialBtn.innerHTML.should.equal("Bar");
    div.outerHTML.should.equal(
      '<div id="d1" hx-get="/test" hx-swap="none" class=""><button id="b1">Bar</button></div>',
    );
  });

  it("keeps the element live in an outer morph when node type changes", function () {
    this.server.respondWith(
      "GET",
      "/test",
      "<div id='b1' hx-swap='morph' hx-get='/test2' class='bar'>Foo</div>",
    );
    this.server.respondWith(
      "GET",
      "/test2",
      "<button id='b1' hx-swap='morph' hx-get='/test3' class='doh'>Foo</button>",
    );
    let initialBtn = makeForHtmxTest(
      "<button id='b1' hx-swap='morph' hx-get='/test'>Foo</button>",
    );

    initialBtn.click();
    this.server.respond();
    let newDiv = document.getElementById("b1");

    newDiv.classList.contains("bar").should.equal(true);
    newDiv.classList.contains("doh").should.equal(false);

    newDiv.click();
    this.server.respond();
    let newBtn = document.getElementById("b1");
    newBtn.classList.contains("bar").should.equal(false);
    newBtn.classList.contains("doh").should.equal(true);
  });

  it("morph attributes correctly", function () {
    this.server.respondWith(
      "GET",
      "/test",
      "<button id='b1' hx-swap='morph:attributes' hx-get='/test' class='bar'>Bar</button>",
    );
    let initialBtn = makeForHtmxTest(
      "<button id='b1' hx-swap='morph:attributes' hx-get='/test'>Foo</button>",
    );
    initialBtn.click();
    this.server.respond();
    let newBtn = document.getElementById("b1");
    initialBtn.should.equal(newBtn);
    initialBtn.classList.contains("bar").should.equal(true);
    initialBtn.outerHTML.should.equal(
      '<button id="b1" hx-swap="morph:attributes" hx-get="/test" class="bar">Foo</button>',
    );
  });

  it("morph attributes correctly with oob-swap", function () {
    this.server.respondWith(
      "GET",
      "/test",
      "<div id='d1' hx-swap-oob='morph;attributes' class='bar'>Bar</div>",
    );
    let div = makeForHtmxTest(
      "<div id='d1' hx-get='/test' hx-swap='none'>Foo</div>",
    );
    div.click();
    this.server.respond();
    div.classList.contains("bar").should.equal(true);
    div.innerHTML.should.equal("Foo");
  });

  it("morph removeAttributes correctly", function () {
    this.server.respondWith(
      "GET",
      "/test",
      "<button id='b1' hx-swap='morph:removeAttributes' hx-get='/test2' class='bar'>Bar</button>",
    );
    let initialBtn = makeForHtmxTest(
      "<button id='b1' hx-swap='morph:removeAttributes' hx-get='/test' remove='me'>Foo</button>",
    );
    initialBtn.click();
    this.server.respond();
    initialBtn.classList.contains("bar").should.equal(false);
    initialBtn.outerHTML.should.equal(
      '<button id="b1" hx-swap="morph:removeAttributes" hx-get="/test" class="">Foo</button>',
    );
  });

  it("morph addAttributes correctly", function () {
    this.server.respondWith(
      "GET",
      "/test",
      "<button id='b1' hx-swap='morph:addAttributes' hx-get='/test2' add='me'>Bar</button>",
    );
    let initialBtn = makeForHtmxTest(
      "<button id='b1' hx-swap='morph:addAttributes' hx-get='/test' leave='me'>Foo</button>",
    );
    initialBtn.click();
    this.server.respond();
    initialBtn.outerHTML.should.equal(
      '<button id="b1" hx-swap="morph:addAttributes" hx-get="/test2" leave="me" class="" add="me">Foo</button>',
    );
  });

  it("keeps the element stable in an outer morph when upgrading outerHTML to morph", function () {
    this.server.respondWith(
      "GET",
      "/test",
      "<button id='b1' hx-swap='outerHTML' hx-get='/test' class='bar'>Foo</button>",
    );
    let initialBtn = makeForHtmxTest(
      "<button id='b1' hx-swap='outerHTML' hx-get='/test'>Foo</button>",
    );
    initialBtn.click();
    this.server.respond();
    initialBtn.classList.contains("bar").should.equal(true);
  });

  it("keeps elements stable in an inner morph when upgrading innerHTML to morph:innerHTML", function () {
    this.server.respondWith(
      "GET",
      "/test",
      "<button id='b1' class='bar'>Foo</button>",
    );
    let div = makeForHtmxTest(
      "<div hx-swap='innerHTML' hx-get='/test'><button id='b1'>Foo</button></div>",
    );
    let initialBtn = document.getElementById("b1");
    div.click();
    this.server.respond();
    let newBtn = document.getElementById("b1");
    initialBtn.should.equal(newBtn);
    initialBtn.classList.contains("bar").should.equal(true);
    div.innerHTML.should.equal(initialBtn.outerHTML);
  });

  it("does not keep the element stable in an outerHTML swap when morphByDefault false", function () {
    htmx.config.morphByDefault = false;
    this.server.respondWith(
      "GET",
      "/test",
      "<button id='b1' hx-swap='outerHTML' hx-get='/test' class='bar'>Foo</button>",
    );
    let initialBtn = makeForHtmxTest(
      "<button id='b1' hx-swap='outerHTML' hx-get='/test'>Foo</button>",
    );
    initialBtn.click();
    this.server.respond();
    delete htmx.config.morphByDefault;
    initialBtn.classList.contains("bar").should.equal(false);
  });

  it("does not keep elements stable in an innerHTML swap when morphByDefault false", function () {
    htmx.config.morphByDefault = false;
    this.server.respondWith(
      "GET",
      "/test",
      "<button id='b1' class='bar'>Foo</button>",
    );
    let div = makeForHtmxTest(
      "<div hx-swap='innerHTML' hx-get='/test'><button id='b1'>Foo</button></div>",
    );
    let initialBtn = document.getElementById("b1");
    div.click();
    this.server.respond();
    delete htmx.config.morphByDefault;
    initialBtn.classList.contains("bar").should.equal(false);
    div.innerHTML.should.not.equal(initialBtn.outerHTML);
  });

  it("keeps the element stable in an outer morph when upgrading default of outerHTML to morph", function () {
    htmx.config.defaultSwapStyle = "outerHTML";
    this.server.respondWith(
      "GET",
      "/test",
      "<button id='b1' hx-get='/test' class='bar'>Foo</button>",
    );
    let initialBtn = makeForHtmxTest(
      "<button id='b1' hx-get='/test'>Foo</button>",
    );
    initialBtn.click();
    this.server.respond();
    initialBtn.classList.contains("bar").should.equal(true);
    htmx.config.defaultSwapStyle = "innerHTML";
  });

  it("keeps the element stable in an outerHTML oob-swap upgraded to morph", function () {
    this.server.respondWith(
      "GET",
      "/test",
      "<button id='b1' hx-swap-oob='outerHTML'>Bar</button>",
    );
    let div = makeForHtmxTest(
      "<div hx-get='/test' hx-swap='none'><button id='b1'>Foo</button></div>",
    );
    let initialBtn = document.getElementById("b1");
    div.click();
    this.server.respond();
    let newBtn = document.getElementById("b1");
    initialBtn.should.equal(newBtn);
    initialBtn.innerHTML.should.equal("Bar");
  });

  it("keeps the element stable in an true oob-swap upgraded to morph", function () {
    this.server.respondWith(
      "GET",
      "/test",
      '<button id="b1" hx-swap-oob="true">Bar</button>',
    );
    let div = makeForHtmxTest(
      "<div hx-get='/test' hx-swap='none'><button id='b1'>Foo</button></div>",
    );
    let initialBtn = document.getElementById("b1");
    div.click();
    this.server.respond();
    let newBtn = document.getElementById("b1");
    initialBtn.should.equal(newBtn);
    initialBtn.innerHTML.should.equal("Bar");
  });

  it("xxxxxxxxxxxxxx", function () {
    this.server.respondWith(
      "GET",
      "/test",
      "<button id='b1' class='bar'>Foo</button>",
    );
    let div = makeForHtmxTest(
      "<div hx-swap='morph:innerHTML' hx-get='/test'><button id='b1'>Foo</button></div>",
    );
    Idiomorph.defaults.eventCallbacks = "beforeNodeMorphed";
    document.body.setAttribute(
      "hx-on-im-before-node-morphed",
      "event.preventDefault();",
    );
    htmx.process(document.body);
    let initialBtn = document.getElementById("b1");
    div.click();
    this.server.respond();
    initialBtn.classList.contains("bar").should.equal(false);
    div.innerHTML.should.equal(initialBtn.outerHTML);
    document.body.removeAttribute("hx-on-im-before-node-morphed");
    htmx.process(document.body);
  });
});
