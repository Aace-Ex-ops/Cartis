import gleam/erlang/process.{type Subject}
import gleam/list

pub type Broadcaster = Subject(Msg)

/// Message pushed to a connected dashboard/extension websocket.
pub type WsMessage {
  BroadcastText(String)
}

/// Internal broadcast-registry messages.
pub type Msg {
  Register(Subject(WsMessage))
  Broadcast(String)
}

/// Spawns the broadcast registry loop and returns its subject.
/// Clients register their own `Subject(WsMessage)`; `Broadcast` fans out.
/// ponytail: dead clients are never pruned (send to a dead subject is a no-op);
/// prune on WS close events when client counts matter.
pub fn start() -> Subject(Msg) {
  let reply = process.new_subject()
  let _ = process.spawn(fn() {
    let subject = process.new_subject()
    process.send(reply, subject)
    loop(subject, [])
  })
  let assert Ok(subject) = process.receive(reply, 5000)
  subject
}

fn loop(subject: Subject(Msg), clients: List(Subject(WsMessage))) {
  let selector = process.new_selector() |> process.select(subject)
  case process.selector_receive_forever(selector) {
    Register(client) -> loop(subject, [client, ..clients])
    Broadcast(text) -> {
      list.each(clients, fn(client) { process.send(client, BroadcastText(text)) })
      loop(subject, clients)
    }
  }
}

pub fn register(broadcaster: Subject(Msg), client: Subject(WsMessage)) -> Nil {
  process.send(broadcaster, Register(client))
}

pub fn broadcast(broadcaster: Subject(Msg), text: String) -> Nil {
  process.send(broadcaster, Broadcast(text))
}
