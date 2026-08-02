import gleam/erlang/process
import gleam/int
import gleam/result
import gleam/json
import broadcast

/// Mock price-index scan: every 10s push a drifting price for one GTIN.
/// ponytail: single mock product, no real e-commerce fetch and no Redis
/// `price_index:{gtin}` / `XADD stream:price_update` writes yet — add a
/// gleam redis client (not on hex as of writing) when the real scan lands.
pub fn start(broadcaster: broadcast.Broadcaster) -> process.Pid {
  process.spawn(fn() { scan_loop(broadcaster, 0) })
}

fn scan_loop(broadcaster: broadcast.Broadcaster, tick: Int) {
  let price = 14999.0 -. int.to_float(int.modulo(tick, 10) |> result.unwrap(0)) *. 100.0
  let old_price = price +. 100.0
  let event =
    json.object([
      #("type", json.string("price_update")),
      #("gtin", json.string("8901234567890")),
      #("site", json.string("flipkart")),
      #("old_price", json.float(old_price)),
      #("new_price", json.float(price)),
    ])
    |> json.to_string
  broadcast.broadcast(broadcaster, event)
  process.sleep(10_000)
  scan_loop(broadcaster, tick + 1)
}
