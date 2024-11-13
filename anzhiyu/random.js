var posts=["2024/11/13/hello-world/","2024/11/13/程序设计实验三/"];function toRandomPost(){
    pjax.loadUrl('/'+posts[Math.floor(Math.random() * posts.length)]);
  };