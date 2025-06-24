{
  "targets": [
    {
      "target_name": "screen_protection",
      "sources": [ "src/screen_protection.cc" ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],

      "defines": [ "NAPI_CPP_EXCEPTIONS" ],
      "libraries": [ "user32.lib" ]
    }
  ]
}
