var posts=["2024/11/10/hello-world/","2024/11/11/测试/"];function toRandomPost(){
    pjax.loadUrl('/'+posts[Math.floor(Math.random() * posts.length)]);
  };