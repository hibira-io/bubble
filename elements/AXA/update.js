function(instance, properties, context) {
    if (!instance.data.ready) return;
    instance.data.status.css('display', properties.show_status ? 'inline-block' : 'none');
    instance.data.hibira.update({
        app_key: context.keys['App key'],
        host: context.keys['Host'],
        channel: properties.channel,
        events: properties.events,
        value_key: properties.value_key,
        name_key: properties.name_key
    });
}
