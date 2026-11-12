package com.tonywu.planner;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import androidx.activity.EdgeToEdge;
import androidx.annotation.NonNull;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsAnimationCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import java.util.List;

public class MainActivity extends BridgeActivity {
    private boolean imeAnimating = false;
    private int lastSent = -1;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // 画面铺到状态栏和手势条后面；页面里用 --safe-area-inset-* 自己留白
        // 必须在 super.onCreate 之后：那里才从启动画面主题切到正式主题（无标题栏）
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);
        trackKeyboard();
    }

    // 键盘动画的每一帧都把“键盘当前露出多高”告诉页面（window.__ime），弹窗逐帧跟着走，
    // 和键盘严丝合缝。Keyboard 插件只在动画开始 / 结束各发一次事件，页面只能自己猜曲线，总是对不上。
    // 插件在 super.onCreate 里装好了它的动画回调（同一个 View 只能有一个），这里替换掉；页面不再用插件的事件。
    private void trackKeyboard() {
        View root = getWindow().getDecorView();
        ViewCompat.setWindowInsetsAnimationCallback(
            root,
            new WindowInsetsAnimationCompat.Callback(WindowInsetsAnimationCompat.Callback.DISPATCH_MODE_STOP) {
                @Override
                public void onPrepare(@NonNull WindowInsetsAnimationCompat animation) {
                    if (isIme(animation)) imeAnimating = true;
                }

                @NonNull
                @Override
                public WindowInsetsAnimationCompat.BoundsCompat onStart(
                    @NonNull WindowInsetsAnimationCompat animation,
                    @NonNull WindowInsetsAnimationCompat.BoundsCompat bounds
                ) {
                    return bounds;
                }

                @NonNull
                @Override
                public WindowInsetsCompat onProgress(
                    @NonNull WindowInsetsCompat insets,
                    @NonNull List<WindowInsetsAnimationCompat> running
                ) {
                    send(insets, true);
                    return insets;
                }

                @Override
                public void onEnd(@NonNull WindowInsetsAnimationCompat animation) {
                    if (!isIme(animation)) return;
                    imeAnimating = false;
                    WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(root);
                    if (insets != null) send(insets, false);
                }
            }
        );
        // 没有动画的变化（比如切换输入法面板高度）走这里；动画进行中以逐帧的值为准
        WebView web = getBridge().getWebView();
        ViewCompat.setOnApplyWindowInsetsListener(web, (v, insets) -> {
            if (!imeAnimating) send(insets, false);
            return ViewCompat.onApplyWindowInsets(v, insets);
        });
    }

    private static boolean isIme(WindowInsetsAnimationCompat a) {
        return (a.getTypeMask() & WindowInsetsCompat.Type.ime()) != 0;
    }

    // 只算手势条以上的部分（页面底部本来就给手势条留了白），单位换成 CSS 像素
    private void send(WindowInsetsCompat insets, boolean animating) {
        Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
        Insets nav = insets.getInsets(WindowInsetsCompat.Type.navigationBars());
        float density = getResources().getDisplayMetrics().density;
        int h = Math.round(Math.max(0, ime.bottom - nav.bottom) / density);
        if (h == lastSent && animating) return;
        lastSent = h;
        WebView web = getBridge().getWebView();
        if (web != null) web.evaluateJavascript("window.__ime&&__ime(" + h + "," + animating + ")", null);
    }
}
