from otree.api import (
    models, BaseConstants, BaseSubsession, BaseGroup, BasePlayer,
    Currency as c, Page
)
import random

class C(BaseConstants):
    NAME_IN_URL = 'risk_preferences'
    PLAYERS_PER_GROUP = None
    NUM_ROUNDS = 1
  
    # 定义安全选项和风险选项的收益
    safe_option_a = c(2.00)
    safe_option_b = c(1.60)
    risky_option_a = c(3.85)
    risky_option_b = c(0.10)
  
    # 10个决策的概率（百分比）
    probabilities = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

class Subsession(BaseSubsession):
    pass

class Group(BaseGroup):
    pass

class Player(BasePlayer):
    # 用于存储10个决策的字段（0 = 安全选项，1 = 风险选项）
    decision_1 = models.IntegerField(choices=[[0, '选项A'], [1, '选项B']])
    decision_2 = models.IntegerField(choices=[[0, '选项A'], [1, '选项B']])
    decision_3 = models.IntegerField(choices=[[0, '选项A'], [1, '选项B']])
    decision_4 = models.IntegerField(choices=[[0, '选项A'], [1, '选项B']])
    decision_5 = models.IntegerField(choices=[[0, '选项A'], [1, '选项B']])
    decision_6 = models.IntegerField(choices=[[0, '选项A'], [1, '选项B']])
    decision_7 = models.IntegerField(choices=[[0, '选项A'], [1, '选项B']])
    decision_8 = models.IntegerField(choices=[[0, '选项A'], [1, '选项B']])
    decision_9 = models.IntegerField(choices=[[0, '选项A'], [1, '选项B']])
    decision_10 = models.IntegerField(choices=[[0, '选项A'], [1, '选项B']])
  
    # 用于存储被选中结算的决策编号和结果
    paying_decision = models.IntegerField()
    outcome = models.BooleanField()  # True = 高收益，False = 低收益
  
    # 计算收益的方法
    def determine_payoff(self):
        # 随机选择一个决策用于支付
        self.paying_decision = random.randint(1, 10)
      
        # 获取该决策的选择（0 = 安全选项，1 = 风险选项）
        decision_attr = f'decision_{self.paying_decision}'
        choice = getattr(self, decision_attr)
      
        # 获取所选决策的概率
        prob = C.probabilities[self.paying_decision - 1]
      
        # 确定结果（成功与否）
        self.outcome = random.random() * 100 <= prob
      
        # 根据选择和结果计算收益
        if choice == 0:  # 选择了安全选项
            self.payoff = C.safe_option_a if self.outcome else C.safe_option_b
        else:  # 选择了风险选项
            self.payoff = C.risky_option_a if self.outcome else C.risky_option_b


# PAGES

class Introduction(Page):
    """介绍页面，包含实验说明"""
    pass

class Decision(Page):
    """参与者做决策的页面"""
    form_model = 'player'
    form_fields = [f'decision_{i}' for i in range(1, 11)]
  
    def vars_for_template(player: Player):
        # Calculate probability pairs for each decision
        probability_pairs = [(p, 100 - p) for p in C.probabilities]
        
        return {
            'probability_pairs': probability_pairs,
            'safe_option_a': C.safe_option_a,
            'safe_option_b': C.safe_option_b,
            'risky_option_a': C.risky_option_a,
            'risky_option_b': C.risky_option_b,
        }
        
    @staticmethod
    def before_next_page(player: Player, timeout_happened):
        player.determine_payoff()

class Results(Page):
    """显示结果和收益的页面"""
  
    def vars_for_template(player: Player):
        return {
            'paying_decision': player.paying_decision,
            'probability': C.probabilities[player.paying_decision - 1],
            'choice': '选项A（安全）' if getattr(player, f'decision_{player.paying_decision}') == 0 else '选项B（风险）',
            'outcome': '高' if player.outcome else '低',
            'payoff': player.payoff,
        }

page_sequence = [Introduction, Decision, Results]