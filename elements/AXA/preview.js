function(instance, properties) {
    var label = properties.channel ? 'Hibira: ' + properties.channel : 'Hibira Channel';
    instance.canvas.append($('<div></div>').text(label).css({
        font: '12px/1.4 system-ui, sans-serif', color: '#0f172a', background: '#e0f2fe',
        border: '1px dashed #38bdf8', borderRadius: '6px', padding: '4px 8px',
        height: '100%', boxSizing: 'border-box', overflow: 'hidden', whiteSpace: 'nowrap'
    }));
}
