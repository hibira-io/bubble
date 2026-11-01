function(instance, properties, context) {
    if (instance.data.ready) instance.data.hibira.sendClientEvent(properties);
}
