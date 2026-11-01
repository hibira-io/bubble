# Changelog

## 0.1.0 (unreleased)

- Hibira Channel element: join public, private and presence channels, react to events (Last event, Last data,
  Last value), presence members and join/leave events, client events, Reconnect and Disconnect. Every element on a
  page shares one connection.
- Private and presence channels are authorized by a Bubble workflow (Hibira - Authorize channel, then Complete
  authorization), so Current User decides who may join. No backend workflow or paid Bubble plan needed.
- Server actions: Publish event, Authorize channel, Request approval, Get approval, Get channel users.
