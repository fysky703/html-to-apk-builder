package com.appcontroller.agent;

import android.app.*;
import android.app.admin.DevicePolicyManager;
import android.content.*;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.view.*;
import android.widget.*;
import java.util.*;

public class MainActivity extends Activity {
    LinearLayout root;
    TextView status;
    EditText token, chatId;

    int dp(float v){ return (int)(v*getResources().getDisplayMetrics().density+0.5f); }

    @Override public void onCreate(Bundle b){
        super.onCreate(b);
        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(20),dp(22),dp(20),dp(20));
        root.setBackgroundColor(Color.rgb(7,11,22));

        TextView title = new TextView(this);
        title.setText("APP CONTROLLER");
        title.setTextColor(Color.WHITE); title.setTextSize(25); title.setTypeface(null,1);
        root.addView(title, new LinearLayout.LayoutParams(-1,dp(48)));

        TextView sub = new TextView(this);
        sub.setText("Remote Android Agent  •  No Root");
        sub.setTextColor(Color.rgb(155,169,192)); sub.setTextSize(14);
        root.addView(sub);

        status = new TextView(this);
        status.setText("● Agent ready");
        status.setTextColor(Color.rgb(99,179,255)); status.setTextSize(15);
        status.setPadding(0,dp(18),0,dp(12)); root.addView(status);

        token = field("Telegram Bot Token");
        chatId = field("Allowed Chat ID");
        root.addView(token); root.addView(chatId);

        Button save = button("SAVE TELEGRAM SETTINGS");
        save.setOnClickListener(v -> {
            getPreferences(0).edit().putString("token",token.getText().toString().trim())
                    .putString("chat",chatId.getText().toString().trim()).apply();
            status.setText("● Settings saved");
        });
        root.addView(save);

        Button access = button("ENABLE ACCESSIBILITY");
        access.setOnClickListener(v -> startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)));
        root.addView(access);

        Button overlay = button("ALLOW SCREEN OVERLAY");
        overlay.setOnClickListener(v -> {
            if(!Settings.canDrawOverlays(this))
                startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:"+getPackageName())));
        });
        root.addView(overlay);

        Button admin = button("ENABLE LOCK-SCREEN CONTROL");
        admin.setOnClickListener(v -> startActivity(new Intent(this,DeviceAdminActivity.class)));
        root.addView(admin);

        Button start = button("START TELEGRAM AGENT");
        start.setOnClickListener(v -> {
            Intent i=new Intent(this,TelegramService.class);
            if(android.os.Build.VERSION.SDK_INT>=26) startForegroundService(i); else startService(i);
            status.setText("● Telegram agent running");
        });
        root.addView(start);

        Button sound = button("TEST SOUND");
        sound.setOnClickListener(v -> {
            Intent i=new Intent(this,AudioService.class);
            i.setAction("PLAY"); startService(i);
        });
        root.addView(sound);

        setContentView(root);
    }

    EditText field(String hint){
        EditText e=new EditText(this); e.setHint(hint); e.setHintTextColor(Color.rgb(120,135,155));
        e.setTextColor(Color.WHITE); e.setSingleLine(true); e.setPadding(dp(16),0,dp(16),0);
        e.setBackgroundColor(Color.rgb(18,26,42));
        LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,dp(54)); p.setMargins(0,dp(6),0,dp(6));
        e.setLayoutParams(p); return e;
    }
    Button button(String text){
        Button b=new Button(this); b.setText(text); b.setTextColor(Color.WHITE); b.setTextSize(13);
        b.setBackgroundColor(Color.rgb(25,45,72));
        LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,dp(52)); p.setMargins(0,dp(5),0,dp(5));
        b.setLayoutParams(p); return b;
    }
}
