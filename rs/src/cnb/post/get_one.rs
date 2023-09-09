use crate::cnb::oauth::Token;
use crate::cnb::post::PostReq;
use crate::http::body_or_err;
use crate::infra::http::setup_auth;
use crate::infra::result::{HomoResult, ResultExt};
use crate::{blog_backend, panic_hook};
use alloc::format;
use alloc::string::String;
use anyhow::Result;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(js_class = PostReq)]
impl PostReq {
    #[wasm_bindgen(js_name = getOne)]
    pub async fn export_get_one(&self, post_id: usize) -> HomoResult<String> {
        panic_hook!();
        let result = get_one(&self.token, post_id).await;
        result.homo_string()
    }
}

async fn get_one(token: &Token, post_id: usize) -> Result<String> {
    let url = blog_backend!("/posts/{}", post_id);

    let client = reqwest::Client::new();

    let req = {
        let req = client.get(url);
        setup_auth(req, &token.token, token.is_pat)
    };

    let resp = req.send().await?;
    body_or_err(resp).await
}
