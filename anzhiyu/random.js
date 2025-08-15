var posts=["2025/08/13/代码分析/","2025/04/22/一直在一起/"];function toRandomPost(){
    pjax.loadUrl('/'+posts[Math.floor(Math.random() * posts.length)]);
  };