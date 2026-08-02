import gleam/erlang/process
import gleam/http/request.{type Request}
import gleam/http/response.{type Response}
import gleam/bytes_tree
import gleam/option.{type Option}
import mist
import broadcast
import pricescan

pub fn main() {
  let broadcaster = broadcast.start()
  let assert Ok(_) =
    mist.new(fn(req: Request(mist.Connection)) {
      case request.path_segments(req) {
        ["health"] -> response.new(200) |> response.set_body(mist.Bytes(bytes_tree.from_string("ok")))
        ["ws"] -> handle_ws(req, broadcaster)
        _ -> response.new(404) |> response.set_body(mist.Bytes(bytes_tree.from_string("not found")))
      }
    })
    |> mist.port(8002)
    |> mist.start()
  pricescan.start(broadcaster)
  process.sleep_forever()
}

fn handle_ws(
  request: Request(mist.Connection),
  broadcaster: broadcast.Broadcaster,
) -> Response(mist.ResponseData) {
  mist.websocket(
    request: request,
    handler: handle_message,
    on_init: on_init(broadcaster),
    on_close: fn(_state) { Nil },
  )
}

fn on_init(broadcaster: broadcast.Broadcaster) -> fn(mist.WebsocketConnection) -> #(Nil, Option(process.Selector(broadcast.WsMessage))) {
  fn(_connection: mist.WebsocketConnection) {
    let client = process.new_subject()
    broadcast.register(broadcaster, client)
    let selector = process.new_selector() |> process.select(client)
    #(Nil, option.Some(selector))
  }
}

fn handle_message(
  state: Nil,
  message: mist.WebsocketMessage(broadcast.WsMessage),
  connection: mist.WebsocketConnection,
) -> mist.Next(Nil, broadcast.WsMessage) {
  case message {
    mist.Custom(broadcast.BroadcastText(text)) -> {
      let _ = mist.send_text_frame(connection, text)
      mist.continue(state)
    }
    _ -> mist.continue(state)
  }
}
