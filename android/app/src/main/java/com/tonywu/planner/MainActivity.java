package com.tonywu.planner;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // 画面铺到状态栏和手势条后面；页面里用 --safe-area-inset-* 自己留白
        // 必须在 super.onCreate 之后：那里才从启动画面主题切到正式主题（无标题栏）
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);
    }
}
