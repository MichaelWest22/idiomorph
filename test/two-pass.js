describe("Two-pass option for retaining more state", function(){

    beforeEach(function() {
        clearWorkArea();
    });

    it('fails to preserve all non-attribute element state with single-pass option', function()
    {
        getWorkArea().append(make(`
            <div>
              <input type="checkbox" id="first">
              <input type="checkbox" id="second">
            </div>
        `));
        document.getElementById("first").indeterminate = true
        document.getElementById("second").indeterminate = true

        let finalSrc = `
            <div>
              <input type="checkbox" id="second">
              <input type="checkbox" id="first">
            </div>
        `;
        Idiomorph.morph(getWorkArea(), finalSrc, {morphStyle:'innerHTML'});

        getWorkArea().innerHTML.should.equal(finalSrc);
        const states = Array.from(getWorkArea().querySelectorAll("input")).map(e => e.indeterminate);
        states.should.eql([true, false]);
    });

    it('preserves all non-attribute element state with two-pass option', function()
    {
        getWorkArea().append(make(`
            <div>
              <input type="checkbox" id="first">
              <input type="checkbox" id="second">
            </div>
        `));
        document.getElementById("first").indeterminate = true
        document.getElementById("second").indeterminate = true

        let finalSrc = `
            <div>
              <input type="checkbox" id="second">
              <input type="checkbox" id="first">
            </div>
        `;
        Idiomorph.morph(getWorkArea(), finalSrc, {morphStyle:'innerHTML',twoPass:true});

        getWorkArea().innerHTML.should.equal(finalSrc);
        const states = Array.from(getWorkArea().querySelectorAll("input")).map(e => e.indeterminate);
        states.should.eql([true, true]);
    });

    it('preserves all non-attribute element state with two-pass option and outerHTML morphStyle', function()
    {
        const div = make(`
            <div>
              <input type="checkbox" id="first">
              <input type="checkbox" id="second">
            </div>
        `);
        getWorkArea().append(div);
        document.getElementById("first").indeterminate = true
        document.getElementById("second").indeterminate = true

        let finalSrc = `
            <div>
              <input type="checkbox" id="second">
              <input type="checkbox" id="first">
            </div>
        `;
        Idiomorph.morph(div, finalSrc, {morphStyle:'outerHTML',twoPass:true});

        getWorkArea().innerHTML.should.equal(finalSrc);
        const states = Array.from(getWorkArea().querySelectorAll("input")).map(e => e.indeterminate);
        states.should.eql([true, true]);
    });

    it('preserves non-attribute state when elements are moved to different levels of the DOM', function()
    {
        getWorkArea().append(make(`
            <div>
              <input type="checkbox" id="first">
              <div>
                <input type="checkbox" id="second">
              </div>
            </div>
        `));
        document.getElementById("first").indeterminate = true
        document.getElementById("second").indeterminate = true

        let finalSrc = `
            <div>
              <input type="checkbox" id="first">
              <input type="checkbox" id="second">
            </div>
        `;
        Idiomorph.morph(getWorkArea(), finalSrc, {morphStyle:'innerHTML',twoPass:true});

        getWorkArea().innerHTML.should.equal(finalSrc);
        const states = Array.from(getWorkArea().querySelectorAll("input")).map(e => e.indeterminate);
        states.should.eql([true, true]);
    });

    it('preserves non-attribute state when elements are moved to different levels of the DOM', function()
    {
        getWorkArea().append(make(`
            <div>
              <input type="checkbox" id="first">
              <div>
                <input type="checkbox" id="second">
              </div>
            </div>
        `));
        document.getElementById("first").indeterminate = true
        document.getElementById("second").indeterminate = true

        let finalSrc = `
            <div>
              <input type="checkbox" id="first">
              <input type="checkbox" id="second">
            </div>
        `;
        Idiomorph.morph(getWorkArea(), finalSrc, {morphStyle:'innerHTML',twoPass:true});

        getWorkArea().innerHTML.should.equal(finalSrc);
        const states = Array.from(getWorkArea().querySelectorAll("input")).map(e => e.indeterminate);
        states.should.eql([true, true]);
    });

    it('preserves non-attribute state when elements are moved between different containers', function()
    {
        getWorkArea().append(make(`
            <div>
              <div id="left">
                <input type="checkbox" id="first">
              </div>
              <div id="right">
                <input type="checkbox" id="second">
              </div>
            </div>
        `));
        document.getElementById("first").indeterminate = true
        document.getElementById("second").indeterminate = true

        let finalSrc = `
            <div>
              <div id="left">
                <input type="checkbox" id="second">
              </div>
              <div id="right">
                <input type="checkbox" id="first">
              </div>
            </div>
        `;
        Idiomorph.morph(getWorkArea(), finalSrc, {morphStyle:'innerHTML',twoPass:true});

        getWorkArea().innerHTML.should.equal(finalSrc);
        const states = Array.from(getWorkArea().querySelectorAll("input")).map(e => e.indeterminate);
        states.should.eql([true, true]);
    });

    it('preserves non-attribute state when parents are reorderd', function()
    {
        getWorkArea().append(make(`
            <div>
              <div id="left">
                <input type="checkbox" id="first">
              </div>
              <div id="right">
                <input type="checkbox" id="second">
              </div>
            </div>
        `));
        document.getElementById("first").indeterminate = true
        document.getElementById("second").indeterminate = true

        let finalSrc = `
            <div>
              <div id="right">
                <input type="checkbox" id="second">
              </div>
              <div id="left">
                <input type="checkbox" id="first">
              </div>
            </div>
        `;
        Idiomorph.morph(getWorkArea(), finalSrc, {morphStyle:'innerHTML',twoPass:true});

        getWorkArea().innerHTML.should.equal(finalSrc);
        const states = Array.from(getWorkArea().querySelectorAll("input")).map(e => e.indeterminate);
        states.should.eql([true, true]);
    });
});
