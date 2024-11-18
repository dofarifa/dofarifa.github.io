var posts=["2024/11/13/程序设计实验三/","2024/11/19/程序设计实验四/"];function toRandomPost(){
    pjax.loadUrl('/'+posts[Math.floor(Math.random() * posts.length)]);
  };