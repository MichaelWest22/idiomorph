describe("Two-pass option for retaining more state", function(){

    beforeEach(function() {
        clearWorkArea();
    });

    it('fails to preserve all non-attribute element state with single-pass option', function()
    {
        getWorkArea().append(make(`
            <div>
              <input type="checkbox" checked id="first">
              <input type="checkbox" checked id="second">
            </div>
        `));
        document.getElementById("first").indeterminate = true
        document.getElementById("second").indeterminate = true

        let finalSrc = `
            <div>
              <input type="checkbox" checked id="second">
              <input type="checkbox" checked id="first">
            </div>
        `;
        Idiomorph.morph(getWorkArea(), finalSrc, {morphStyle:'innerHTML'});

        document.getElementById("first").indeterminate.should.be.false
        document.getElementById("second").indeterminate.should.be.true
    });

    it('preserves all non-attribute element state with two-pass option', function()
    {
        getWorkArea().append(make(`
            <div>
              <input type="checkbox" checked id="first">
              <input type="checkbox" checked id="second">
            </div>
        `));
        document.getElementById("first").indeterminate = true
        document.getElementById("second").indeterminate = true

        let finalSrc = `
            <div>
              <input type="checkbox" checked id="second">
              <input type="checkbox" checked id="first">
            </div>
        `;
        Idiomorph.morph(getWorkArea(), finalSrc, {morphStyle:'innerHTML',twoPass:true});

        document.getElementById("first").indeterminate.should.be.true
        document.getElementById("second").indeterminate.should.be.true
    });
});
