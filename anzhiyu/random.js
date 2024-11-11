var posts=["2024/11/11/hello-world/","2024/11/11/牛王牛王我们喜欢你/"];function toRandomPost(){
    pjax.loadUrl('/'+posts[Math.floor(Math.random() * posts.length)]);
  };