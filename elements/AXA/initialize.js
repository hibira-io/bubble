function(instance, context) {
    instance.data.ready = false;
    instance.data.status = $('<div></div>').css({
        display: 'none', font: '12px/1.4 system-ui, sans-serif', color: '#475569',
        padding: '2px 8px', borderRadius: '999px', background: '#f1f5f9',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
    });
    instance.canvas.append(instance.data.status);
    if (!window.HibiraBubble) {
        instance.publishState('error', 'The Hibira runtime did not load.');
        return;
    }
    instance.data.hibira = new window.HibiraBubble.Element({
        publish: function (name, value) {
            instance.publishState(name, value);
            if (name === 'connection_state' && instance.data.status) {
                instance.data.status.text('Hibira: ' + value);
            }
        },
        trigger: function (name) { instance.triggerEvent(name); }
    });
    instance.data.ready = true;
}
